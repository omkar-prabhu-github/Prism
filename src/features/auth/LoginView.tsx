import React, { useState } from 'react';
import {
  Card, FormLayout, TextField, Button, Text, BlockStack,
  InlineStack, Banner, Box, Divider,
} from '@shopify/polaris';

interface LoginViewProps {
  onExtract: (domain: string, token: string) => void;
  error?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({ onExtract, error }) => {
  const [oauthDomain, setOauthDomain] = useState('');

  const handleOAuthInstall = () => {
    if (!oauthDomain) return;
    let shop = oauthDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!shop.includes('.')) shop = `${shop}.myshopify.com`;
    window.location.href = `http://localhost:3000/api/auth?shop=${shop}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--p-color-bg-surface-secondary)',
      padding: 20,
    }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div className="axiom-fade-in">
          <Card>
            <BlockStack gap="500">
              {/* Header */}
              <BlockStack gap="200" inlineAlign="center">
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'var(--p-color-bg-fill-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, color: '#fff',
                  letterSpacing: -0.5,
                }}>P</div>
                <Text as="h1" variant="headingLg" alignment="center">Prism</Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Connect your Shopify store to begin
                </Text>
              </BlockStack>

              {error && <Banner tone="critical"><p>{error}</p></Banner>}

              <BlockStack gap="400">
                <TextField label="Store Name" value={oauthDomain} onChange={setOauthDomain}
                  placeholder="e.g. mystore" suffix=".myshopify.com" autoComplete="off" />
                <Text as="p" variant="bodySm" tone="subdued">
                  You'll be redirected to Shopify to authorize access.
                </Text>
                <Button onClick={handleOAuthInstall} variant="primary" fullWidth size="large">
                  Install with Shopify
                </Button>
              </BlockStack>
            </BlockStack>
          </Card>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text as="p" variant="bodySm" tone="subdued">
            Prism · AI-Powered Store Assistant
          </Text>
        </div>
      </div>
    </div>
  );
};
