function handleAuthError(response: Response) {
  if (response.status === 401) {
    sessionStorage.clear();
    window.location.reload();
    throw new Error('Session expired');
  }
}

export async function fetchStoreAudit(shop: string, token: string) {
  const response = await fetch('/api/audit/store', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
    body: JSON.stringify({ shop }),
  });
  handleAuthError(response);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'GEO audit failed');
  }
  return response.json();
}

export async function fetchSeoAudit(shop: string, token: string) {
  const response = await fetch('/api/audit/seo', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Shopify-Domain': shop,
      'X-Shopify-Token': token,
    },
    body: JSON.stringify({ shop }),
  });
  handleAuthError(response);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'SEO audit failed');
  }
  return response.json();
}
