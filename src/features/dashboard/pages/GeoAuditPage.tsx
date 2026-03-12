import React, { useState } from 'react';
import {
  Page, Card, Text, Badge, Button, BlockStack, InlineStack,
  Box, Banner, Spinner, Divider, Collapsible, Icon, Grid,
} from '@shopify/polaris';
import { ChartVerticalIcon, SearchIcon } from '@shopify/polaris-icons';
import { HealthGauge } from '../components/HealthGauge';
import { useStoreAudit } from '../hooks/useStoreAudit';
import { useDashboard } from '../DashboardContext';
import { useI18n } from '../../../i18n/I18nContext';

// ── Layer Score Row ──
function LayerRow({ label, score, max, idx, details }: {
  label: string; score: number; max: number; idx: number; details: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round((score / max) * 100);
  const color = pct >= 70 ? 'var(--p-color-bg-fill-success)' :
                pct >= 40 ? 'var(--p-color-bg-fill-caution)' :
                'var(--p-color-bg-fill-critical)';
  const dotColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
      background: idx % 2 === 0 ? 'transparent' : 'var(--p-color-bg-surface-secondary)',
    }}
      onClick={() => setExpanded(!expanded)}
    >
      <InlineStack align="space-between" blockAlign="center">
        <InlineStack gap="200" blockAlign="center">
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor, flexShrink: 0,
          }} />
          <Text as="span" variant="bodySm">{label}</Text>
          <span style={{
            fontSize: 10, color: 'var(--p-color-text-secondary)',
            display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>&#9660;</span>
        </InlineStack>
        <Text as="span" variant="bodySm" fontWeight="semibold">{score}/{max}</Text>
      </InlineStack>
      <div style={{ marginLeft: 24, marginTop: 4 }}>
        <div className="axiom-score-track">
          <div className="axiom-score-fill" style={{ background: color, width: `${pct}%` }} />
        </div>
      </div>

      <Collapsible open={expanded} id={`layer-${label}`}>
        <div style={{
          marginTop: 10, marginLeft: 24, padding: '12px 16px',
          background: 'var(--p-color-bg-surface)', borderRadius: 8,
          borderLeft: `3px solid ${dotColor}`,
        }}>
          <Text as="p" variant="bodySm" tone="subdued">{details}</Text>
        </div>
      </Collapsible>
    </div>
  );
}

// ── Action Item Card ──
function ActionItemCard({ item }: {
  item: { title: string; description: string; severity: string };
}) {
  const sev = item.severity || 'LOW';
  const accents: Record<string, { border: string; accent: string }> = {
    CRITICAL: { border: '#fecaca', accent: '#dc2626' },
    HIGH: { border: '#fed7aa', accent: '#ea580c' },
    MEDIUM: { border: '#fde68a', accent: '#d97706' },
    LOW: { border: '#bbf7d0', accent: '#16a34a' },
  };
  const style = accents[sev] || accents.LOW;

  return (
    <div style={{
      background: 'var(--p-color-bg-surface)', borderRadius: 12,
      border: `1px solid ${style.border}`,
      borderLeft: `4px solid ${style.accent}`,
    }}>
      <div style={{ padding: '12px 16px' }}>
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <InlineStack gap="200" blockAlign="center">
              <Text as="span" variant="bodyMd" fontWeight="semibold">{item.title}</Text>
              <Badge tone={sev === 'CRITICAL' ? 'critical' : sev === 'HIGH' ? 'warning' : sev === 'MEDIUM' ? 'attention' : 'info'}>
                {sev}
              </Badge>
            </InlineStack>
            <Box paddingBlockStart="100">
              <Text as="p" variant="bodyMd" tone="subdued">{item.description}</Text>
            </Box>
          </div>
        </InlineStack>
      </div>
    </div>
  );
}

// ── Shared: Render audit results ──
function AuditResults({ audit, type }: { audit: any; type: 'geo' | 'seo' }) {
  const isGeo = type === 'geo';
  const exec = audit?.executiveSummary;
  const score = isGeo ? (exec?.geoHealthScore || 0) : (exec?.seoHealthScore || 0);
  const threatLabel = isGeo ? 'Top threat' : 'Top issue';
  const threatValue = isGeo ? exec?.topThreat : exec?.topIssue;

  const layerScores = isGeo ? audit?.geoLayerScores : audit?.seoLayerScores;
  const categoryScores = audit?.categoryScores;
  const plan = audit?.diagnosticsAndActionPlan;

  const geoLayers = [
    { key: 'schema', label: 'Schema & structured data', max: 20 },
    { key: 'contentQuality', label: 'Content quality', max: 20 },
    { key: 'trust', label: 'Trust signals', max: 15 },
    { key: 'extractability', label: 'Extractability', max: 15 },
    { key: 'journeyPolicy', label: 'Journey & policy', max: 20 },
    { key: 'crossEngine', label: 'Cross-engine visibility', max: 10 },
  ];

  const seoLayers = [
    { key: 'technicalSeo', label: 'Technical SEO', max: 20 },
    { key: 'onPageSeo', label: 'On-page SEO', max: 20 },
    { key: 'contentQuality', label: 'Content quality', max: 20 },
    { key: 'imageOptimization', label: 'Image optimization', max: 15 },
    { key: 'trustAuthority', label: 'Trust & authority', max: 15 },
    { key: 'siteArchitecture', label: 'Site architecture', max: 10 },
  ];

  const layers = isGeo ? geoLayers : seoLayers;

  const geoCats = [
    { key: 'storeInfrastructure', label: 'Store setup' },
    { key: 'informationMismatch', label: 'Info accuracy' },
    { key: 'productOptimization', label: 'Product quality' },
    { key: 'strategicGrowth', label: 'Growth' },
  ];

  const seoCats = [
    { key: 'technicalSeo', label: 'Technical' },
    { key: 'onPageSeo', label: 'On-page' },
    { key: 'contentQuality', label: 'Content' },
    { key: 'imageAndMedia', label: 'Images' },
  ];

  const cats = isGeo ? geoCats : seoCats;

  // Collect all action items
  const allItems = cats.flatMap(cat =>
    (plan?.[cat.key] || []).map((item: any) => ({ ...item, category: cat.label }))
  );
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  allItems.sort((a: any, b: any) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  return (
    <BlockStack gap="400">
      {/* Health + Executive Summary */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 0 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px',
            borderRight: '1px solid var(--p-color-border-secondary)',
          }}>
            <HealthGauge score={score} />
            <div style={{ marginTop: 8 }}>
              <Badge tone={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'critical'}>
                Grade: {exec?.grade || '—'}
              </Badge>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">Executive summary</Text>
              <Divider />
              <Box padding="300" background="bg-surface-critical" borderRadius="200">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="semibold" tone="critical">{threatLabel}</Text>
                  <Text as="p" variant="bodySm">{threatValue || '—'}</Text>
                </BlockStack>
              </Box>
              <Box padding="300" background="bg-surface-success" borderRadius="200">
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" fontWeight="semibold" tone="success">Top opportunity</Text>
                  <Text as="p" variant="bodySm">{exec?.topOpportunity || '—'}</Text>
                </BlockStack>
              </Box>
            </BlockStack>
          </div>
        </div>
      </Card>


      {/* Layer Scores */}
      {layerScores && (
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">{isGeo ? 'GEO layer scores' : 'SEO layer scores'}</Text>
            <Divider />
            <div>
              {layers.map((layer, idx) => {
                const entry = layerScores[layer.key] as any;
                const sc = entry?.score ?? 0;
                const details = entry?.reasoning || entry?.detail || entry?.details || entry?.notes || '';
                return <LayerRow key={layer.key} label={layer.label} score={sc} max={layer.max} idx={idx} details={details} />;
              })}
            </div>
          </BlockStack>
        </Card>
      )}

      {/* Action Plan */}
      {allItems.length > 0 && (
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">Suggestions</Text>
            <Divider />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allItems.map((item: any, i: number) => (
                <ActionItemCard key={i} item={item} />
              ))}
            </div>
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}

// ── Main Page ──
export const GeoAuditPage: React.FC<Props> = ({ onBack }) => {
  const { shop, token } = useDashboard();
  const { t } = useI18n();
  const {
    geoAudit, seoAudit,
    geoLoading, seoLoading,
    geoError, seoError,
    runGeoAudit, runSeoAudit,
    clearGeoAudit, clearSeoAudit,
    clearGeoError, clearSeoError,
  } = useStoreAudit(shop, token);

  const [activeTab, setActiveTab] = useState<'geo' | 'seo' | null>(null);

  if (activeTab === null) {
    return (
      <Page title="Store Audits">
        <div className="axiom-fade-in simplified-container">
          <BlockStack gap="500">
            <Box paddingBlockEnd="400">
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h2" variant="headingXl" alignment="center">
                  Select an audit to run
                </Text>
                <Text as="p" variant="bodyLg" tone="subdued" alignment="center">
                  Analyze your store's performance for AI and traditional search engines.
                </Text>
              </BlockStack>
            </Box>
            
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                <div style={{ cursor: 'pointer', height: '100%' }} onClick={() => setActiveTab('geo')} className="axiom-card-interactive">
                  <Card>
                    <Box padding="600">
                      <BlockStack gap="400" inlineAlign="center">
                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <div style={{ transform: 'scale(1.3)' }}>
                            <Icon source={ChartVerticalIcon} color="base" />
                          </div>
                        </Box>
                        <Text as="h3" variant="headingLg" alignment="center">GEO Audit</Text>
                        <Text as="p" tone="subdued" alignment="center" variant="bodyLg">Analyze visibility in AI engines like ChatGPT, Gemini, and Perplexity.</Text>
                      </BlockStack>
                    </Box>
                  </Card>
                </div>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                <div style={{ cursor: 'pointer', height: '100%' }} onClick={() => setActiveTab('seo')} className="axiom-card-interactive">
                  <Card>
                    <Box padding="600">
                      <BlockStack gap="400" inlineAlign="center">
                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <div style={{ transform: 'scale(1.3)' }}>
                            <Icon source={SearchIcon} color="base" />
                          </div>
                        </Box>
                        <Text as="h3" variant="headingLg" alignment="center">SEO Audit</Text>
                        <Text as="p" tone="subdued" alignment="center" variant="bodyLg">Analyze visibility in traditional search engines like Google and Bing.</Text>
                      </BlockStack>
                    </Box>
                  </Card>
                </div>
              </Grid.Cell>
            </Grid>
          </BlockStack>
        </div>
      </Page>
    );
  }

  const currentAudit = activeTab === 'geo' ? geoAudit : seoAudit;
  const currentLoading = activeTab === 'geo' ? geoLoading : seoLoading;
  const currentError = activeTab === 'geo' ? geoError : seoError;

  return (
    <Page 
      title={t('audit.title')}
      backAction={{ content: 'Back to Audits', onAction: () => setActiveTab(null) }}
      primaryAction={
        !currentLoading ? {
          content: currentAudit ? `Re-run ${activeTab === 'geo' ? 'GEO' : 'SEO'} audit` : `Run ${activeTab === 'geo' ? 'GEO' : 'SEO'} audit`,
          onAction: () => {
            if (activeTab === 'geo') {
              if (geoAudit) clearGeoAudit();
              setTimeout(runGeoAudit, 100);
            } else {
              if (seoAudit) clearSeoAudit();
              setTimeout(runSeoAudit, 100);
            }
          }
        } : undefined
      }
    >
      <BlockStack gap="400">
        {/* Loading State */}
        {currentLoading && (
          <Card>
            <Box padding="800">
              <BlockStack gap="300" align="center" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" variant="bodyMd">
                  {activeTab === 'geo'
                    ? 'Analyzing your store for AI engine visibility...'
                    : 'Analyzing your store for search engine optimization...'}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  This may take up to a minute.
                </Text>
              </BlockStack>
            </Box>
          </Card>
        )}

        {/* Error */}
        {currentError && (
          <Banner tone="critical" onDismiss={activeTab === 'geo' ? clearGeoError : clearSeoError}>
            <p>{currentError}</p>
          </Banner>
        )}

        {/* Empty State */}
        {!currentAudit && !currentLoading && (
          <Card>
            <Box padding="800">
              <BlockStack gap="300" align="center" inlineAlign="center">
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <Icon source={activeTab === 'geo' ? ChartVerticalIcon : SearchIcon} />
                </Box>
                <Text as="p" variant="headingSm">
                  {activeTab === 'geo' ? 'Run your first GEO audit' : 'Run your first SEO audit'}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  {activeTab === 'geo'
                    ? 'Analyze how well your store performs in AI-powered search engines like ChatGPT, Gemini, and Perplexity.'
                    : 'Analyze how well your store performs in traditional search engines like Google, Bing, and Yahoo.'}
                </Text>
                <Box paddingBlockStart="200">
                  <Button variant="primary" onClick={activeTab === 'geo' ? runGeoAudit : runSeoAudit}>
                    {activeTab === 'geo' ? 'Run GEO audit' : 'Run SEO audit'}
                  </Button>
                </Box>
              </BlockStack>
            </Box>
          </Card>
        )}

        {/* Results */}
        {currentAudit && !currentLoading && (
          <AuditResults audit={currentAudit} type={activeTab} />
        )}

        <Box paddingBlockEnd="800" />
      </BlockStack>
    </Page>
  );
};
