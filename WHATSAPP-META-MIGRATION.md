# Migrating from Twilio to Meta WhatsApp Cloud API

## Why migrate?

Twilio's WhatsApp Sandbox has a **50 messages/day limit** and requires each number to "join" the sandbox manually. The Meta Cloud API (via Facebook Business Developer) gives you:

- **1,000 free conversations/month** (service conversations are unlimited since June 2023)
- No sandbox join requirement — any WhatsApp user can message you
- Direct access to WhatsApp Business features (catalog, templates, etc.)

---

## Step 1: Create a Meta Developer Account

1. Go to [developers.facebook.com](https://developers.facebook.com/)
2. Log in with your Facebook account
3. Click **My Apps** > **Create App**
4. Select **Business** as the app type
5. Fill in the app name (e.g., "WhatsApp Onboarding") and click **Create App**

---

## Step 2: Add WhatsApp to your app

1. In your app dashboard, click **Add Product**
2. Find **WhatsApp** and click **Set Up**
3. You'll be redirected to the WhatsApp Getting Started page
4. Meta provides a **test phone number** and a **Phone number ID** — note these down

---

## Step 3: Get your credentials

From the WhatsApp > **API Setup** page, note:

| Credential | Where to find it |
|---|---|
| **Temporary Access Token** | Shown on the API Setup page (expires in 24h) |
| **Phone Number ID** | Under the test number dropdown |
| **WhatsApp Business Account ID** | In the sidebar or URL |

For a **permanent token**:

1. Go to **Business Settings** > **System Users**
2. Create a system user with **Admin** role
3. Add your app with **full control**
4. Click **Generate Token** — select `whatsapp_business_messaging` and `whatsapp_business_management` permissions
5. Save this token securely — it won't expire

---

## Step 4: Configure the Webhook

1. In your app dashboard, go to **WhatsApp** > **Configuration**
2. Under **Webhook**, click **Edit**
3. Set the **Callback URL** to your server:
   ```
   https://your-domain.com/webhook/whatsapp
   ```
4. Set a **Verify Token** (any string you choose, e.g., `my_verify_token_123`)
5. Click **Verify and Save**
6. Subscribe to the **messages** webhook field

### Webhook verification

Meta sends a GET request to verify your endpoint. Your server needs to handle this:

```
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```

It must respond with the `hub.challenge` value if the verify token matches.

### CRITICAL: Subscribe your app to the WhatsApp Business Account

> **Without this step, your webhook will be verified but you will NEVER receive incoming messages. There are no error messages or logs — messages simply don't arrive.**

By default, Meta's test WhatsApp Business Account (WABA) is only linked to Meta's internal test app (`WA DevX Webhook Events 1P App`), **not your app**. You must subscribe your app to the WABA via the API:

```bash
curl -X POST "https://graph.facebook.com/v21.0/{WABA_ID}/subscribed_apps" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

Replace `{WABA_ID}` with your WhatsApp Business Account ID (found in the sidebar or webhook payloads as `entry[0].id`).

To verify the subscription worked:

```bash
curl "https://graph.facebook.com/v21.0/{WABA_ID}/subscribed_apps" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

You should see your app name in the response. If you only see `WA DevX Webhook Events 1P App`, your app is **not** subscribed and won't receive webhooks.

---

## Step 5: Sending messages

Meta uses a REST API instead of a client library.

**Endpoint:**
```
POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
```

**Headers:**
```
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

**Send a text message:**
```json
{
  "messaging_product": "whatsapp",
  "to": "34613444502",
  "type": "text",
  "text": {
    "body": "Hello from Meta Cloud API!"
  }
}
```

> Note: Phone numbers use international format **without** the `+` or `whatsapp:` prefix.

---

## Step 6: Receiving messages (Webhook payload)

Meta's webhook payload is different from Twilio's. An incoming message looks like:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "YOUR_NUMBER",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "contacts": [
              {
                "profile": { "name": "Customer Name" },
                "wa_id": "34613444502"
              }
            ],
            "messages": [
              {
                "from": "34613444502",
                "id": "wamid.xxxxx",
                "timestamp": "1234567890",
                "text": { "body": "Hola quiero hacer un pedido" },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Key differences from Twilio:**

| Field | Twilio | Meta Cloud API |
|---|---|---|
| Sender phone | `req.body.From` = `whatsapp:+34613444502` | `entry[0].changes[0].value.messages[0].from` = `34613444502` |
| Message text | `req.body.Body` | `entry[0].changes[0].value.messages[0].text.body` |
| Sender name | `req.body.ProfileName` | `entry[0].changes[0].value.contacts[0].profile.name` |
| Data format | URL-encoded form data | JSON |

---

## Step 7: Add a test number

To test during development:

1. Go to **WhatsApp** > **API Setup**
2. Under **To**, click **Manage phone number list**
3. Add your personal phone number and verify it via code
4. You can now send/receive messages with the test number

In production, you'll register your own business phone number.

---

## Environment variables needed

When you migrate the code, these are the env vars you'll need:

```env
# Meta WhatsApp Cloud API
META_WHATSAPP_TOKEN=your_permanent_access_token
META_PHONE_NUMBER_ID=your_phone_number_id
META_VERIFY_TOKEN=my_verify_token_123
```

---

## Summary of code changes needed

When you're ready to modify the code, these files will need changes:

1. **`src/routes/webhook.js`** — Handle GET for verification + parse the Meta JSON payload instead of Twilio form data
2. **`src/utils/extract-message.js`** — Extract from/text/profileName from Meta's nested JSON structure
3. **`src/services/twilio.js`** — Replace Twilio SDK with `fetch()` calls to Meta's Graph API
4. **`src/index.js`** — Ensure `express.json()` middleware is active (already is)
5. **Phone number format** — Meta uses plain numbers (`34613444502`) instead of Twilio's `whatsapp:+34613444502` format. The database phone fields would need to match whichever format you choose.

---

## Useful links

- [Meta WhatsApp Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Getting started guide](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Webhook reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Message API reference](https://developers.facebook.com/docs/whatsapp/cloud-api/messages)
- [Pricing](https://developers.facebook.com/docs/whatsapp/pricing)
