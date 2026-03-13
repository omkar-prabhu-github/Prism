import { useState } from 'react';
import { fetchStoreAudit, fetchSeoAudit } from '../../../api/auditClient';

const GEO_CACHE_KEY = 'sellx_geo_audit';
const SEO_CACHE_KEY = 'sellx_seo_audit';

export function useStoreAudit(shop: string, token: string) {
  const getCache = (key: string) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  };

  const [geoAudit, setGeoAudit] = useState<any | null>(getCache(GEO_CACHE_KEY));
  const [seoAudit, setSeoAudit] = useState<any | null>(getCache(SEO_CACHE_KEY));
  const [geoLoading, setGeoLoading] = useState(false);
  const [seoLoading, setSeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [seoError, setSeoError] = useState('');

  const runGeoAudit = async () => {
    setGeoError('');
    setGeoLoading(true);
    try {
      const result = await fetchStoreAudit(shop, token);
      setGeoAudit(result);
      try { sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(result)); } catch {}
    } catch (e: any) {
      setGeoError(e.message || 'GEO audit failed');
    } finally {
      setGeoLoading(false);
    }
  };

  const runSeoAudit = async () => {
    setSeoError('');
    setSeoLoading(true);
    try {
      const result = await fetchSeoAudit(shop, token);
      setSeoAudit(result);
      try { sessionStorage.setItem(SEO_CACHE_KEY, JSON.stringify(result)); } catch {}
    } catch (e: any) {
      setSeoError(e.message || 'SEO audit failed');
    } finally {
      setSeoLoading(false);
    }
  };

  const clearGeoAudit = () => {
    sessionStorage.removeItem(GEO_CACHE_KEY);
    setGeoAudit(null);
  };

  const clearSeoAudit = () => {
    sessionStorage.removeItem(SEO_CACHE_KEY);
    setSeoAudit(null);
  };

  return {
    geoAudit,
    seoAudit,
    geoLoading,
    seoLoading,
    geoError,
    seoError,
    runGeoAudit,
    runSeoAudit,
    clearGeoAudit,
    clearSeoAudit,
    clearGeoError: () => setGeoError(''),
    clearSeoError: () => setSeoError(''),
  };
}
