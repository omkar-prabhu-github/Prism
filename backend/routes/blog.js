import express from 'express';
import { generateBlogPost } from '../services/ai/gemini.js';
import { getValidToken, normalizeDomain, shopifyRest, httpsRequest } from '../services/shopify/rest.js';

const router = express.Router();

// POST /api/blog/generate — generate a blog post via AI
router.post('/generate', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  try {
    console.log(`✍️ Generating blog: "${topic}" for ${shop}`);
    const generated = await generateBlogPost(topic);
    return res.json({ ok: true, generated });
  } catch (err) {
    console.error('Blog generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/blog/publish — publish blog content to Shopify
router.post('/publish', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const { blogId, title, bodyHtml, tags } = req.body;
  if (!blogId || !title || !bodyHtml) return res.status(400).json({ error: 'Missing required fields' });

  const token = await getValidToken(shop, reqToken);

  try {
    const articlePayload = JSON.stringify({
      article: {
        title,
        body_html: bodyHtml,
        tags: Array.isArray(tags) ? tags.join(', ') : (tags || ''),
        published: true,
      },
    });

    const createUrl = `${normalizeDomain(shop)}/admin/api/2024-10/blogs/${blogId}/articles.json`;
    const createRes = await httpsRequest(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        'Content-Length': Buffer.byteLength(articlePayload),
      },
    }, articlePayload);

    const result = createRes.json();
    if (!createRes.ok) {
      throw new Error(result?.errors ? JSON.stringify(result.errors) : `HTTP ${createRes.status}`);
    }

    console.log(`✅ Blog published: "${title}"`);
    return res.json({ ok: true, published: true, article: result?.article || null });
  } catch (err) {
    console.error('Blog publish error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/blog/list — list all blogs
router.get('/list', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing auth headers' });

  const token = await getValidToken(shop, reqToken);
  try {
    const data = await shopifyRest(shop, token, 'blogs.json');
    const blogs = (data?.blogs || []).map(b => ({ id: b.id, title: b.title, handle: b.handle }));
    return res.json({ blogs });
  } catch (err) {
    console.warn('Blog list failed:', err.message);
    return res.json({ blogs: [] });
  }
});

export default router;
 