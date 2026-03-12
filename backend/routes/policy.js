import express from 'express';
import { generatePolicies } from '../services/ai/gemini.js';
import { getValidToken, normalizeDomain, httpsRequest } from '../services/shopify/rest.js';

const router = express.Router();

// POST /api/policy/generate — generate all 4 policies from questionnaire answers
router.post('/generate', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { businessName, deliveryDays, returnWindow, contactEmail, region, dataCollection } = req.body;
  if (!businessName || !deliveryDays || !returnWindow || !contactEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log(`📜 Policy generation requested for "${businessName}" (${shop})`);
    const generated = await generatePolicies({
      businessName, deliveryDays, returnWindow, contactEmail,
      region: region || 'United States',
      dataCollection: dataCollection || ['email', 'name'],
    });

    return res.json({ ok: true, generated });
  } catch (err) {
    console.error('Policy generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/policy/publish — publish generated policies to Shopify
router.post('/publish', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { shippingPolicy, refundPolicy, privacyPolicy, termsOfService } = req.body;
  if (!shippingPolicy && !refundPolicy && !privacyPolicy && !termsOfService) {
    return res.status(400).json({ error: 'At least one policy is required' });
  }

  const token = await getValidToken(shop, reqToken);
  const domain = normalizeDomain(shop);
  const endpoint = `${domain}/admin/api/2024-10/graphql.json`;

  const POLICY_MAP = {
    shippingPolicy: 'SHIPPING_POLICY',
    refundPolicy: 'REFUND_POLICY',
    privacyPolicy: 'PRIVACY_POLICY',
    termsOfService: 'TERMS_OF_SERVICE',
  };

  const policies = { shippingPolicy, refundPolicy, privacyPolicy, termsOfService };
  const results = {};
  const errors = [];

  for (const [key, type] of Object.entries(POLICY_MAP)) {
    if (!policies[key]) continue;

    try {
      const mutation = `mutation shopPolicyUpdate($shopPolicy: ShopPolicyInput!) {
        shopPolicyUpdate(shopPolicy: $shopPolicy) {
          shopPolicy { id body type }
          userErrors { field message }
        }
      }`;

      const variables = { shopPolicy: { type, body: policies[key] } };
      const bodyStr = JSON.stringify({ query: mutation, variables });

      const gqlRes = await httpsRequest(endpoint, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }, bodyStr);

      const data = gqlRes.json();
      const result = data?.data?.shopPolicyUpdate;
      const userErrors = result?.userErrors || [];

      if (userErrors.length > 0) {
        const msgs = userErrors.map(e => e.message).join(', ');
        console.warn(`⚠️ ${key} errors: ${msgs}`);
        
        if (msgs.toLowerCase().includes('automatic management')) {
          errors.push({ policy: key, error: `This policy is auto-managed by Shopify. Turn off "Automatically generated" in Settings → Policies first.` });
        } else {
          errors.push({ policy: key, error: msgs });
        }
      } else {
        console.log(`✅ ${type} updated successfully`);
        results[key] = true;
      }
    } catch (err) {
      console.error(`❌ ${key} update failed:`, err.message);
      errors.push({ policy: key, error: err.message });
    }
  }

  return res.json({
    ok: true,
    results,
    errors: errors.length > 0 ? errors : undefined,
    allPublished: errors.length === 0,
  });
});

export default router;
   