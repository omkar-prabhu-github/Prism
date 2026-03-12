import express from 'express';
import { runGeoAudit, runSeoAudit } from '../services/ai/gemini.js';
import { fetchInternalStoreData } from '../services/shopify/data.js';

const router = express.Router();

router.post('/store', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing or unauthorized session tokens' });

  try {
    const storeData = await fetchInternalStoreData(shop, reqToken);
    if (!storeData || !storeData.catalog) throw new Error('Secure data fetch failed');

    const frontendAudit = await runGeoAudit(shop, storeData);
    console.log('[GEO Audit] Complete: score=' + frontendAudit.executiveSummary?.geoHealthScore + ', grade=' + frontendAudit.executiveSummary?.grade);
    return res.json(frontendAudit);
  } catch (err) {
    console.error('[GEO Audit] Error:', err.message);
    return res.status(500).json({ error: 'GEO audit failed: ' + err.message });
  }
});

router.post('/seo', async (req, res) => {
  const shop = req.headers['x-shopify-domain'];
  const reqToken = req.headers['x-shopify-token'];
  
  if (!shop || !reqToken) return res.status(401).json({ error: 'Missing or unauthorized session tokens' });

  try {
    const storeData = await fetchInternalStoreData(shop, reqToken);
    if (!storeData || !storeData.catalog) throw new Error('Secure data fetch failed');

    const seoAudit = await runSeoAudit(shop, storeData);
    console.log('[SEO Audit] Complete: score=' + seoAudit.executiveSummary?.seoHealthScore + ', grade=' + seoAudit.executiveSummary?.grade);
    return res.json(seoAudit);
  } catch (err) {
    console.error('[SEO Audit] Error:', err.message);
    return res.status(500).json({ error: 'SEO audit failed: ' + err.message });
  }
});

export default router;
    