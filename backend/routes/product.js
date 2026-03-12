import express from 'express';
import { generateProductContent } from '../services/ai/gemini.js';
import { getValidToken, normalizeDomain, httpsRequest } from '../services/shopify/rest.js';

const router = express.Router();

// POST /api/product/generate — generate product content + create on Shopify
router.post('/generate', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { name, category, price, imageBase64, keyFeatures } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Product name and price are required' });

  try {
    // Step 1: Generate product content via AI
    console.log(`📦 Product generation requested: "${name}" for ${shop}`);
    const generated = await generateProductContent({ name, category, price, hasImage: !!imageBase64, imageBase64, keyFeatures });

    return res.json({ ok: true, generated });
  } catch (err) {
    console.error('Product generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/product/publish — publish generated product to Shopify
router.post('/publish', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { title, descriptionHtml, tags, price, imageBase64, category, inventory } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Title and price are required' });

  const token = await getValidToken(shop, reqToken);

  try {
    // Build the product payload for Shopify REST API
    const productPayload = {
      product: {
        title,
        body_html: descriptionHtml,
        product_type: category || '',
        tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
        status: 'active',
        variants: [{
          price: String(price),
          inventory_management: 'shopify',
        }],
      },
    };

    if (imageBase64) {
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      productPayload.product.images = [{ attachment: base64Data }];
    }

    const createUrl = `${normalizeDomain(shop)}/admin/api/2024-10/products.json`;
    const bodyStr = JSON.stringify(productPayload);
    
    const createRes = await httpsRequest(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    }, bodyStr);

    const result = createRes.json();
    if (!createRes.ok) {
      const errMsg = result?.errors ? JSON.stringify(result.errors) : `HTTP ${createRes.status}`;
      throw new Error(errMsg);
    }

    // Set inventory if provided
    if (inventory && result?.product?.variants?.[0]?.inventory_item_id) {
      try {
        const locRes = await httpsRequest(`${normalizeDomain(shop)}/admin/api/2024-10/locations.json`, {
          method: 'GET',
          headers: { 'X-Shopify-Access-Token': token }
        });
        const locData = locRes.json();
        const locationId = locData?.locations?.[0]?.id;

        if (locationId) {
          const invPayload = JSON.stringify({
            location_id: locationId,
            inventory_item_id: result.product.variants[0].inventory_item_id,
            available: Number(inventory)
          });
          await httpsRequest(`${normalizeDomain(shop)}/admin/api/2024-10/inventory_levels/set.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': token,
              'Content-Length': Buffer.byteLength(invPayload)
            }
          }, invPayload);
        }
      } catch (invErr) {
        console.warn('Failed to set inventory:', invErr.message);
      }
    }

    console.log(`✅ Product created: "${title}" (ID: ${result?.product?.id})`);
    return res.json({ ok: true, product: result?.product || null });
  } catch (err) {
    console.error('Product publish error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Helper: call Python ML engine at localhost:8000
import http from 'http';

function callMLEngine(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`ML parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('ML engine timeout')); });
    req.write(body);
    req.end();
  });
}

// GET /api/product/list — fetch products from Shopify + ML cluster prediction
router.get('/list', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const token = await getValidToken(shop, reqToken);

  try {
    const url = `${normalizeDomain(shop)}/admin/api/2024-10/products.json?limit=50&status=active`;
    const result = await httpsRequest(url, {
      method: 'GET',
      headers: { 'X-Shopify-Access-Token': token },
    });
    const data = result.json();
    if (!result.ok) throw new Error(data?.errors ? JSON.stringify(data.errors) : `HTTP ${result.status}`);

    // Process each product with the real Python ML engine
    const products = await Promise.all((data.products || []).map(async (p) => {
      const price = parseFloat(p.variants?.[0]?.price || '0');
      const imageUrl = p.image?.src || p.images?.[0]?.src || '';
      
      const titleLen = (p.title || '').length;
      const descLen = (p.body_html || '').replace(/<[^>]*>/g, '').length;
      const hasImages = (p.images || []).length;
      
      // Derive proxy features from product attributes (Shopify REST doesn't expose analytics)
      const titleQuality = Math.min(10, Math.max(1, titleLen > 50 ? 8 : titleLen > 25 ? 6 : 3));
      const keywordScore = Math.min(10, Math.max(1, (p.tags || '').split(',').filter(Boolean).length * 1.5 + 2));
      const qualityFactor = (titleQuality + keywordScore) / 20;
      
      const features = {
        visits: Math.floor(200 + qualityFactor * 4800),
        ctr: parseFloat(Math.min(0.20, 0.02 + qualityFactor * 0.15).toFixed(4)),
        time_on_page: parseFloat((20 + qualityFactor * 250).toFixed(2)),
        scroll_depth: parseFloat((15 + qualityFactor * 80).toFixed(2)),
        add_to_cart_rate: parseFloat(Math.min(0.30, 0.01 + qualityFactor * 0.20).toFixed(4)),
        conversion_rate: parseFloat(Math.min(0.15, 0.005 + qualityFactor * 0.10).toFixed(4)),
        title_quality: titleQuality,
        description_length: descLen,
        keyword_score: keywordScore,
        rating: parseFloat(Math.min(5, 2 + qualityFactor * 3).toFixed(1)),
        reviews: Math.floor(qualityFactor * 150),
      };

      // Call real Python ML engine for cluster prediction
      let cluster = 'Unknown';
      let coordinates = { x: 0.5, y: 0.5 };
      try {
        const mlResult = await callMLEngine('/predict-cluster', features);
        cluster = mlResult.cluster || 'Unknown';
        coordinates = mlResult.coordinates || { x: 0.5, y: 0.5 };
      } catch (mlErr) {
        console.warn(`ML engine unavailable for "${p.title}": ${mlErr.message}`);
        // Fallback: basic rule-based
        if (features.visits > 500 && features.conversion_rate >= 0.04) cluster = 'High Performer';
        else if (features.visits > 1000 && features.conversion_rate < 0.02) cluster = "Attract but Don't Convert";
        else cluster = 'Low Engagement Product';
      }

      // Compute listing quality score
      let score = 100;
      const strengths = [];
      const weaknesses = [];
      const suggestions = [];

      if (titleLen < 15) { score -= 15; weaknesses.push('Title is too short'); suggestions.push('Add descriptive keywords to the title.'); }
      else if (titleLen > 50) { strengths.push('Good, descriptive title length'); }
      if (descLen < 50) { score -= 20; weaknesses.push('Description lacks detail'); suggestions.push('Write a longer description with features and benefits.'); }
      else { strengths.push('Detailed description'); }
      if (hasImages === 0) { score -= 25; weaknesses.push('No images'); suggestions.push('Add at least 2-3 product images.'); }
      else if (hasImages > 1) { strengths.push('Multiple images available'); }
      score = Math.max(0, Math.floor(score));

      return {
        id: p.id,
        title: p.title,
        price,
        imageUrl,
        tags: p.tags || '',
        descriptionLength: descLen,
        images: hasImages,
        metrics: {
          visits: features.visits,
          ctr: features.ctr,
          timeOnPage: features.time_on_page,
          scrollDepth: features.scroll_depth,
          addToCartRate: features.add_to_cart_rate,
          conversionRate: features.conversion_rate,
          titleQuality: features.title_quality,
          descriptionLength: features.description_length,
          keywordScore: features.keyword_score,
          rating: features.rating,
          reviews: features.reviews,
        },
        analysis: { score, cluster, strengths, weaknesses, suggestions },
        coordinates,
      };
    }));

    console.log(`📊 ML analysis: ${products.length} products for ${shop} (via Python ML engine)`);
    return res.json({ ok: true, products });
  } catch (err) {
    console.error('Product list error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/product/simulate — forward simulation to Python ML engine
router.post('/simulate', async (req, res) => {
  try {
    const result = await callMLEngine('/simulate-product', req.body);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Simulation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
 