-- Add retailer_id column to products table (for Meta catalog integration)
ALTER TABLE products ADD COLUMN IF NOT EXISTS retailer_id TEXT DEFAULT NULL;

-- Index for quick lookup by retailer_id
CREATE INDEX IF NOT EXISTS idx_products_retailer_id ON products(retailer_id) WHERE retailer_id IS NOT NULL;
