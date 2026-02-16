const { config } = require('../config');
const db = require('./database');

const API_VERSION = config.meta.apiVersion || 'v21.0';

/**
 * Fetch all products from a Meta catalog.
 */
async function fetchCatalogProducts(token, catalogId) {
  const products = [];
  let url = `https://graph.facebook.com/${API_VERSION}/${catalogId}/products?fields=id,name,retailer_id,description,price,currency,availability,category&limit=100`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.error?.message || 'Failed to fetch catalog';
      console.error('Meta Catalog API error:', msg);
      throw new Error(msg);
    }

    products.push(...(data.data || []));
    url = data.paging?.next || null;
  }

  return products;
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Sync catalog products from Meta into the database.
 * Returns { inserted, updated, skipped, total }.
 */
async function syncCatalogToDatabase(businessId, token, catalogId) {
  const catalogProducts = await fetchCatalogProducts(token, catalogId);

  if (catalogProducts.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, total: 0 };
  }

  const existingProducts = await db.getProductsByBusiness(businessId);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const cp of catalogProducts) {
    const retailerId = cp.retailer_id;
    const name = cp.name || 'Sin nombre';
    const description = cp.description || null;
    const price = parsePrice(cp.price);
    const category = cp.category || null;

    // Check if already exists by retailer_id
    const existing = existingProducts.find((p) => p.retailer_id === retailerId);
    if (existing) {
      skipped++;
      continue;
    }

    // Check if exists by name (fuzzy match)
    const byName = existingProducts.find(
      (p) => p.name.toLowerCase() === name.toLowerCase() && !p.retailer_id
    );

    if (byName) {
      await db.updateProductRetailerId(byName.id, retailerId);
      updated++;
      continue;
    }

    // Insert new product with retailer_id
    await db.insertProducts(businessId, [{ name, description, price, category, retailer_id: retailerId }]);
    inserted++;
  }

  return { inserted, updated, skipped, total: inserted + updated + skipped };
}

/**
 * Update a product's visibility in the Meta catalog.
 * @param {string} token - Meta API token
 * @param {string} catalogId - Meta catalog ID
 * @param {string} retailerId - Product retailer_id
 * @param {boolean} visible - true = published, false = hidden (staging)
 */
async function setProductVisibility(token, catalogId, retailerId, visible) {
  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${catalogId}/items_batch`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item_type: 'PRODUCT_ITEM',
        requests: [
          {
            method: 'UPDATE',
            retailer_id: retailerId,
            data: {
              id: retailerId,
              visibility: visible ? 'published' : 'staging',
            },
          },
        ],
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const msg = data.error?.message || 'Failed to update product visibility';
    console.error('Meta Catalog API visibility error:', msg);
    throw new Error(msg);
  }

  console.log(`📦 [Catalog API] Product ${retailerId} visibility → ${visible ? 'published' : 'staging'}`);
  return data;
}

/**
 * Update a product's availability in the Meta catalog (in stock / out of stock).
 * @param {string} token - Meta API token
 * @param {string} catalogId - Meta catalog ID
 * @param {string} retailerId - Product retailer_id
 * @param {string} availability - "in stock" or "out of stock"
 */
async function setProductAvailability(token, catalogId, retailerId, availability) {
  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${catalogId}/items_batch`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item_type: 'PRODUCT_ITEM',
        requests: [
          {
            method: 'UPDATE',
            retailer_id: retailerId,
            data: {
              id: retailerId,
              availability,
            },
          },
        ],
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const msg = data.error?.message || 'Failed to update product availability';
    console.error('Meta Catalog API availability error:', msg);
    throw new Error(msg);
  }

  console.log(`📦 [Catalog API] Product ${retailerId} availability → ${availability}`);
  return data;
}

/**
 * Update product fields (name, price, description) in the Meta catalog.
 * @param {string} token - Meta API token
 * @param {string} catalogId - Meta catalog ID
 * @param {string} retailerId - Product retailer_id
 * @param {object} fields - { name, price, description } (only include fields to update)
 */
async function updateProductFields(token, catalogId, retailerId, fields) {
  const data = { id: retailerId };
  if (fields.name) data.name = fields.name;
  if (fields.price != null) data.price = `${Math.round(fields.price * 100)} ARS`;
  if (fields.description != null) data.description = fields.description;

  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${catalogId}/items_batch`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item_type: 'PRODUCT_ITEM',
        requests: [
          {
            method: 'UPDATE',
            retailer_id: retailerId,
            data,
          },
        ],
      }),
    }
  );

  const result = await res.json();

  if (!res.ok) {
    const msg = result.error?.message || 'Failed to update product fields';
    console.error('Meta Catalog API update error:', msg);
    throw new Error(msg);
  }

  console.log(`📦 [Catalog API] Product ${retailerId} updated:`, fields);
  return result;
}

module.exports = { fetchCatalogProducts, syncCatalogToDatabase, parsePrice, setProductVisibility, setProductAvailability, updateProductFields };
