import React, { useState, useCallback } from 'react';
import { Page, Card, BlockStack, Text, Grid, Box, Icon, InlineStack, Badge, Button, Tabs, Select } from '@shopify/polaris';
import { PackageIcon, EditIcon, ClipboardIcon, OrderIcon, InfoIcon, GlobeIcon } from '@shopify/polaris-icons';
import { DashboardContext } from './DashboardContext';
import { ProductUploadPage } from './pages/ProductUploadPage';
import { BlogPostPage } from './pages/BlogPostPage';
import { PolicyPage } from './pages/PolicyPage';
import { OrdersPage } from './pages/OrdersPage';
import { GeoAuditPage } from './pages/GeoAuditPage';
import { ClusterDashboardPage } from './pages/ClusterDashboardPage';
import { ShopifyGuidePage } from './pages/ShopifyGuidePage';
import { OnboardingTour } from './components/OnboardingTour';
import { useVoiceFeedback } from '../../hooks/useVoiceFeedback';
import { I18nProvider, useI18n, LANGUAGE_LABELS } from '../../i18n/I18nContext';
import type { Language } from '../../i18n/I18nContext';

interface AppShellProps {
  shop: string;
  token: string;
}

const FEATURES = [
  {
    id: 'products',
    title: 'Add Product',
    desc: 'Upload a photo, AI writes the rest',
    icon: PackageIcon,
    voiceLabel: 'Add Product',
  },
  {
    id: 'blog',
    title: 'Write Blog',
    desc: 'Pick a topic, get a full article',
    icon: EditIcon,
    voiceLabel: 'Write Blog',
  },
  {
    id: 'policies',
    title: 'Setup Rules',
    desc: 'Answer questions, get legal pages',
    icon: ClipboardIcon,
    voiceLabel: 'Setup Rules',
  },
  {
    id: 'orders',
    title: 'Manage Orders',
    desc: 'View orders and ship items easily',
    icon: OrderIcon,
    voiceLabel: 'Manage Orders',
  },
];



// Sub-component so each card can use the voice hook independently
const FeatureCard: React.FC<{
  feature: typeof FEATURES[number];
  onClick: () => void;
}> = ({ feature, onClick }) => {
  const voice = useVoiceFeedback(feature.voiceLabel);

  return (
    <div
      id={`feature-card-${feature.id}`}
      style={{ cursor: 'pointer', height: '100%' }}
      onClick={onClick}
      onMouseEnter={voice.onMouseEnter}
      onMouseLeave={voice.onMouseLeave}
    >
      <Card>
        <BlockStack gap="300" inlineAlign="center">
          <Box padding="400" background="bg-surface-secondary" borderRadius="200">
            <div style={{ transform: 'scale(1.5)' }}>
              <Icon source={feature.icon} color="base" />
            </div>
          </Box>
          <Text as="h3" variant="headingLg" alignment="center">{feature.title}</Text>
          <div style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
            <Text as="p" variant="bodySm" tone="subdued" alignment="center">{feature.desc}</Text>
          </div>
        </BlockStack>
      </Card>
    </div>
  );
};

const AppShellInner: React.FC<AppShellProps> = ({ shop, token }) => {
  const { t, lang, setLang } = useI18n();
  const [selectedTab, setSelectedTab] = useState(0);
  const [activePage, setActivePage] = useState<string | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [langPopoverActive, setLangPopoverActive] = useState(false);

  // Sync with global window object
  React.useEffect(() => {
    (window as any).voiceFeedbackDisabled = voiceMuted;
  }, [voiceMuted]);

  const goHome = useCallback(() => setActivePage(null), []);

  const FEATURES_TRANSLATED = [
    { id: 'products', title: t('home.addProduct'), desc: t('home.addProductDesc'), icon: PackageIcon, voiceLabel: t('home.addProduct') },
    { id: 'blog', title: t('home.writeBlog'), desc: t('home.writeBlogDesc'), icon: EditIcon, voiceLabel: t('home.writeBlog') },
    { id: 'policies', title: t('home.setupRules'), desc: t('home.setupRulesDesc'), icon: ClipboardIcon, voiceLabel: t('home.setupRules') },
    { id: 'orders', title: t('home.manageOrders'), desc: t('home.manageOrdersDesc'), icon: OrderIcon, voiceLabel: t('home.manageOrders') },
  ];

  const LEVEL_TABS = [
    { id: 'level-1', content: t('nav.level1') },
    { id: 'level-2', content: t('nav.level2') },
    { id: 'level-3', content: t('nav.level3') },
    { id: 'level-4', content: t('nav.level4') },
  ];

  const navigateTo = useCallback((page: string | null) => {
    setActivePage(page);
  }, []);

  const renderLevel1Page = () => {
    switch (activePage) {
      case 'products': return <ProductUploadPage onBack={goHome} />;
      case 'blog':     return <BlogPostPage onBack={goHome} />;
      case 'policies': return <PolicyPage onBack={goHome} />;
      case 'orders':   return <OrdersPage onBack={goHome} />;
      default: return null;
    }
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0: // Level 1 — Home
        return activePage ? (
          <div className="axiom-fade-in">
            {renderLevel1Page()}
          </div>
        ) : (
          <Page>
            <div className="axiom-fade-in simplified-container">
              <BlockStack gap="500">
                <Box paddingBlockEnd="400">
                  <BlockStack gap="200" inlineAlign="center">
                    <Badge tone="success">{t('home.badge')}</Badge>
                    <Text as="h2" variant="headingXl" alignment="center">
                      {t('home.title')}
                    </Text>
                    <Text as="p" variant="bodyLg" tone="subdued" alignment="center">
                      {t('home.subtitle')}
                    </Text>
                  </BlockStack>
                </Box>

                <div id="tour-step-home-cards">
                  <Grid>
                    {FEATURES_TRANSLATED.map(f => (
                      <Grid.Cell key={f.id} columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                        <FeatureCard feature={f} onClick={() => setActivePage(f.id)} />
                      </Grid.Cell>
                    ))}
                  </Grid>
                </div>
              </BlockStack>
            </div>
          </Page>
        );

      case 1: // Level 2 — Shopify Guide
        return (
          <div className="axiom-fade-in">
            <ShopifyGuidePage />
          </div>
        );

      case 2: // Level 3 — Audits
        return (
          <div className="axiom-fade-in">
            <GeoAuditPage />
          </div>
        );

      case 3: // Level 4 — Product Intelligence
        return (
          <div className="axiom-fade-in">
            <ClusterDashboardPage />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <DashboardContext.Provider value={{ shop, token }}>
      <OnboardingTour navigate={navigateTo} active={tourActive} onEnd={() => setTourActive(false)} />
      
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top Navigation Tabs */}
        <header style={{
          borderBottom: '1px solid var(--p-color-border)',
          background: 'var(--p-color-bg-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 200,
          flexShrink: 0,
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Tabs
                tabs={LEVEL_TABS}
                selected={selectedTab}
                onSelect={(idx) => {
                  setSelectedTab(idx);
                  setActivePage(null);
                }}
              />
            </div>
            
            <InlineStack gap="300" blockAlign="center">
              {selectedTab === 0 && (
                <>
                  <Select
                    label="Language"
                    labelHidden
                    options={(['en', 'hi', 'kn'] as Language[]).map(l => ({
                      label: LANGUAGE_LABELS[l],
                      value: l,
                    }))}
                    value={lang}
                    onChange={(val) => setLang(val as Language)}
                  />
                  <Button onClick={() => setVoiceMuted(!voiceMuted)}>
                    {voiceMuted ? t('nav.voiceOff') : t('nav.voiceOn')}
                  </Button>
                  <Button variant="primary" tone="success" onClick={() => setTourActive(true)}>
                    {t('nav.playTutorial')}
                  </Button>
                </>
              )}

              {selectedTab === 3 && (
                <Button onClick={() => window.dispatchEvent(new Event('refresh-level-4'))}>
                  {t('nav.refresh')}
                </Button>
              )}
            </InlineStack>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1 }}>
          <div key={`tab-${selectedTab}`} className="axiom-fade-in">
            {renderTabContent()}
          </div>
        </main>
      </div>
    </DashboardContext.Provider>
  );
};

export const AppShell: React.FC<AppShellProps> = (props) => (
  <I18nProvider>
    <AppShellInner {...props} />
  </I18nProvider>
);
