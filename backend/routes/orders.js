import express from 'express';
import { callGeminiForOrders } from '../services/ai/gemini.js';
import { getValidToken, normalizeDomain, httpsRequest } from '../services/shopify/rest.js';

const router = express.Router();

// GET /api/orders/list — fetch recent orders
router.get('/list', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const token = await getValidToken(shop, reqToken);

  try {
    const url = `${normalizeDomain(shop)}/admin/api/2024-10/orders.json?status=any&limit=50&order=created_at+desc`;
    const result = await httpsRequest(url, {
      method: 'GET',
      headers: { 'X-Shopify-Access-Token': token },
    });
    const data = result.json();
    if (!result.ok) throw new Error(data?.errors ? JSON.stringify(data.errors) : `HTTP ${result.status}`);

    // Simplify order data for the frontend
    const orders = (data.orders || []).map(o => ({
      id: o.id,
      name: o.name,                               // "#1001"
      email: o.email || o.contact_email || '',
      createdAt: o.created_at,
      totalPrice: o.total_price,
      currency: o.currency,
      financialStatus: o.financial_status,         // paid, pending, refunded
      fulfillmentStatus: o.fulfillment_status,     // fulfilled, null (unfulfilled), partial
      itemCount: (o.line_items || []).reduce((s, li) => s + li.quantity, 0),
      items: (o.line_items || []).map(li => ({
        title: li.title,
        quantity: li.quantity,
        price: li.price,
      })),
      customer: o.customer ? {
        name: `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() || 'Guest',
        email: o.customer.email || '',
      } : { name: 'Guest', email: '' },
      shippingAddress: o.shipping_address ? {
        city: o.shipping_address.city || '',
        province: o.shipping_address.province || '',
        country: o.shipping_address.country || '',
      } : null,
    }));

    console.log(`📋 Fetched ${orders.length} orders for ${shop}`);
    return res.json({ ok: true, orders });
  } catch (err) {
    console.error('Orders list error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/fulfill — mark an order as fulfilled (via GraphQL)
router.post('/fulfill', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

  const token = await getValidToken(shop, reqToken);
  const graphqlUrl = `${normalizeDomain(shop)}/admin/api/2024-10/graphql.json`;

  try {
    // Step 1: Get fulfillment orders via GraphQL (works with write_orders scope)
    const foQuery = JSON.stringify({
      query: `{
        order(id: "gid://shopify/Order/${orderId}") {
          fulfillmentOrders(first: 5) {
            nodes {
              id
              status
            }
          }
        }
      }`
    });

    const foRes = await httpsRequest(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(foQuery),
      },
    }, foQuery);

    const foData = foRes.json();
    if (!foRes.ok) throw new Error(`GraphQL request failed: ${foRes.status}`);
    if (foData.errors) throw new Error(foData.errors.map(e => e.message).join(', '));

    const foNodes = foData.data?.order?.fulfillmentOrders?.nodes || [];
    const openFO = foNodes.find(fo => fo.status === 'OPEN' || fo.status === 'IN_PROGRESS');
    if (!openFO) throw new Error('No open fulfillment order found — may already be fulfilled.');

    // Step 2: Create fulfillment via GraphQL
    const fulfillMutation = JSON.stringify({
      query: `mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
        fulfillmentCreateV2(fulfillment: $fulfillment) {
          fulfillment { id status }
          userErrors { field message }
        }
      }`,
      variables: {
        fulfillment: {
          lineItemsByFulfillmentOrder: [{
            fulfillmentOrderId: openFO.id
          }],
          notifyCustomer: true
        }
      }
    });

    const fulfillRes = await httpsRequest(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(fulfillMutation),
      },
    }, fulfillMutation);

    const fulfillData = fulfillRes.json();
    if (!fulfillRes.ok) throw new Error(`GraphQL request failed: ${fulfillRes.status}`);

    const userErrors = fulfillData.data?.fulfillmentCreateV2?.userErrors || [];
    if (userErrors.length > 0) throw new Error(userErrors.map(e => e.message).join(', '));
    if (fulfillData.errors) throw new Error(fulfillData.errors.map(e => e.message).join(', '));

    console.log(`✅ Order ${orderId} fulfilled for ${shop}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Fulfill error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/ai-reply — generate a customer message with AI
router.post('/ai-reply', async (req, res) => {
  const { orderSummary, replyType } = req.body;
  if (!orderSummary || !replyType) return res.status(400).json({ error: 'Missing fields' });

  try {
    console.log(`💬 Generating ${replyType} message for order...`);
    const result = await callGeminiForOrders(orderSummary, replyType);
    return res.json({ ok: true, message: result.message, subject: result.subject });
  } catch (err) {
    console.error('AI reply error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/payment/upi — upload UPI QR code to main theme assets
router.post('/payment/upi', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { base64Image } = req.body;
  if (!base64Image) return res.status(400).json({ error: 'Image data is required' });

  const token = await getValidToken(shop, reqToken);

  try {
    console.log(`🆙 Uploading UPI QR code for ${shop}`);
    // 1. Get main theme
    const themeUrl = `${normalizeDomain(shop)}/admin/api/2024-10/themes.json`;
    const themeRes = await httpsRequest(themeUrl, {
      method: 'GET',
      headers: { 'X-Shopify-Access-Token': token },
    });
    const themesData = themeRes.json();
    if (!themeRes.ok) throw new Error('Failed to load themes');
    
    const mainTheme = themesData.themes?.find(t => t.role === 'main');
    if (!mainTheme) throw new Error('No main theme found');

    // 2. Upload asset
    const uploadUrl = `${normalizeDomain(shop)}/admin/api/2024-10/themes/${mainTheme.id}/assets.json`;
    
    // remove data:image/...;base64, prefix safely
    const attachment = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const payload = JSON.stringify({
      asset: {
        key: 'assets/upi_qr.png',
        attachment: attachment
      }
    });

    const uploadRes = await httpsRequest(uploadUrl, {
      method: 'PUT',
      headers: { 
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
    }, payload);

    const uploadData = uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Failed to upload asset: ${JSON.stringify(uploadData)}`);

    console.log(`✅ UPI QR code uploaded to theme ${mainTheme.id}`);
    res.json({ ok: true, message: 'UPI QR code uploaded successfully to your theme assets!' });
  } catch (err) {
    console.error('UPI Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
