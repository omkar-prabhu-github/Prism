import { useState, useEffect, useRef } from 'react';
import { LoginView } from './features/auth/LoginView';
import { ExtractingView } from './features/extraction/ExtractingView';
import { DashboardView } from './features/dashboard/DashboardView';

type ViewState = 'login' | 'connecting' | 'dashboard';

// Detect if we're inside Shopify's embedded iframe
const isEmbedded = window.self !== window.top;

function App() {
  const [view, setView] = useState<ViewState>(isEmbedded ? 'connecting' : 'login');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [shop, setShop] = useState('');
  const [token, setToken] = useState('');
  const autoStarted = useRef(false);

  const handleConnect = (domain: string, accessToken: string) => {
    sessionStorage.setItem('shopify_shop_v2', domain);
    sessionStorage.setItem('shopify_token_v2', accessToken);
    setShop(domain);
    setToken(accessToken);
    setView('dashboard');
  };

  // Auto-connect if shop & token are available
  useEffect(() => {
    if (autoStarted.current) return;

    const params = new URLSearchParams(window.location.search);
    const urlShop = params.get('shop');
    const urlToken = params.get('token');

    if (urlShop && urlToken) {
      autoStarted.current = true;
      window.history.replaceState({}, '', window.location.pathname);
      handleConnect(urlShop, urlToken);
      return;
    }

    if (isEmbedded) {
      let embeddedShop = params.get('shop');
      if (!embeddedShop) {
        try {
          const ref = document.referrer || '';
          const myshopMatch = ref.match(/([a-zA-Z0-9-]+\.myshopify\.com)/);
          if (myshopMatch) embeddedShop = myshopMatch[1];
          if (!embeddedShop) {
            const storeMatch = ref.match(/admin\.shopify\.com\/store\/([a-zA-Z0-9-]+)/);
            if (storeMatch) embeddedShop = `${storeMatch[1]}.myshopify.com`;
          }
        } catch {}
      }

      if (embeddedShop) {
        autoStarted.current = true;
        fetch(`/api/auth/session?shop=${encodeURIComponent(embeddedShop)}`)
          .then(r => r.json())
          .then(data => {
            if (data.token) {
              handleConnect(embeddedShop!, data.token);
            } else {
              window.open(`/api/auth?shop=${encodeURIComponent(embeddedShop!)}`, '_top');
            }
          })
          .catch(() => {
            window.open(`/api/auth?shop=${encodeURIComponent(embeddedShop!)}`, '_top');
          });
      }
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--p-font-family-sans)' }}>
      {view === 'login' && !isEmbedded && (
        <LoginView onExtract={handleConnect} error={errorMessage} />
      )}
      {view === 'connecting' && <ExtractingView />}
      {view === 'dashboard' && shop && token && (
        <DashboardView shop={shop} token={token} />
      )}
    </div>
  );
}

export default App;
