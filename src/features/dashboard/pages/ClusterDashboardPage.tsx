import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Page, Card, BlockStack, InlineStack, Text, Banner,
  Spinner, Badge, Box, Button, Divider, TextField, RangeSlider
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { useI18n } from '../../../i18n/I18nContext';

// ── Cluster color mapping ────────────────────────────────────────────
const CLUSTER_COLORS: Record<string, string> = {
  'High Performer': '#22c55e',
  "Attract but Don't Convert": '#f59e0b',
  'Low Engagement Product': '#3b82f6',
  'Trust Issue Product': '#ef4444',
  'Invisible Product': '#9ca3af',
};

const CLUSTER_TONES: Record<string, 'success' | 'warning' | 'info' | 'critical' | undefined> = {
  'High Performer': 'success',
  "Attract but Don't Convert": 'warning',
  'Low Engagement Product': 'info',
  'Trust Issue Product': 'critical',
  'Invisible Product': undefined,
};

// ── Product type ─────────────────────────────────────────────────────
interface StoreProduct {
  id: number;
  title: string;
  price: number;
  imageUrl: string;
  tags: string;
  descriptionLength: number;
  images: number;
  metrics: {
    visits: number; ctr: number; timeOnPage: number; scrollDepth: number;
    addToCartRate: number; conversionRate: number;
    titleQuality: number; descriptionLength: number; keywordScore: number;
    rating: number; reviews: number;
  };
  analysis: {
    score: number; cluster: string;
    strengths: string[]; weaknesses: string[]; suggestions: string[];
  };
  coordinates: { x: number; y: number };
}

// ── Minimal SVG scatter chart (no recharts dependency) ───────────────
const ScatterChart: React.FC<{
  products: StoreProduct[];
  selectedId: number | null;
  simResult?: any;
  onSelect: (p: StoreProduct) => void;
}> = ({ products, selectedId, simResult, onSelect }) => {
  const W = 560, H = 260;
  const PAD = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const toX = (v: number) => PAD.left + v * chartW;
  const toY = (v: number) => PAD.top + (1 - v) * chartH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <React.Fragment key={`grid-${v}`}>
          <line x1={toX(v)} y1={PAD.top} x2={toX(v)} y2={PAD.top + chartH}
            stroke="#f3f4f6" strokeWidth={1} />
          <line x1={PAD.left} y1={toY(v)} x2={PAD.left + chartW} y2={toY(v)}
            stroke="#f3f4f6" strokeWidth={1} />
        </React.Fragment>
      ))}
      
      {/* Axis labels */}
      <text x={PAD.left + chartW / 2} y={H - 6} textAnchor="middle"
        style={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }}>
        Visibility / Attraction →
      </text>
      <text x={14} y={PAD.top + chartH / 2} textAnchor="middle"
        style={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }}
        transform={`rotate(-90, 14, ${PAD.top + chartH / 2})`}>
        Buyer Confidence →
      </text>

      {/* Tick labels */}
      {[0, 0.5, 1].map(v => (
        <React.Fragment key={`tick-${v}`}>
          <text x={toX(v)} y={PAD.top + chartH + 16} textAnchor="middle"
            style={{ fontSize: 10, fill: '#9ca3af' }}>{(v * 100).toFixed(0)}</text>
          <text x={PAD.left - 8} y={toY(v) + 4} textAnchor="end"
            style={{ fontSize: 10, fill: '#9ca3af' }}>{(v * 100).toFixed(0)}</text>
        </React.Fragment>
      ))}

      {/* Product dots */}
      {products.map(p => {
        const isSelected = p.id === selectedId;
        if (isSelected && simResult) return null; // Hide original dot if simulating

        const color = CLUSTER_COLORS[p.analysis.cluster] || '#9ca3af';
        return (
          <circle
            key={p.id}
            cx={toX(p.coordinates.x)}
            cy={toY(p.coordinates.y)}
            r={isSelected ? 8 : 5}
            fill={color}
            opacity={isSelected ? 1 : 0.55}
            stroke={isSelected ? '#1f2937' : 'none'}
            strokeWidth={isSelected ? 2.5 : 0}
            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
            onClick={() => onSelect(p)}
          />
        );
      })}

      {/* Simulated Dot */}
      {simResult && selectedId && (
        <circle
          cx={toX(simResult.graph_coordinates.x)}
          cy={toY(simResult.graph_coordinates.y)}
          r={10}
          fill={CLUSTER_COLORS[simResult.new_cluster] || '#000'}
          stroke="#fff"
          strokeWidth={2.5}
          style={{ transition: 'all 0.4s ease-out' }}
        />
      )}
    </svg>
  );
};

// ── Main dashboard component ─────────────────────────────────────────
export const ClusterDashboardPage: React.FC = () => {
  const { shop, token } = useDashboard();
  const { t } = useI18n();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Simulation state
  const [localFeatures, setLocalFeatures] = useState<any>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const debounceTimerRef = useRef<any>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/product/list', {
        headers: { 'x-shopify-domain': shop, 'x-shopify-token': token },
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load products');
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [shop, token]);

  const handleSelectProduct = (product: StoreProduct) => {
    setSelectedProduct(product);
    setSimResult({
      new_cluster: product.analysis.cluster,
      graph_coordinates: product.coordinates,
      visibility_score: product.coordinates.x,
      confidence_score: product.coordinates.y,
      new_conversion_rate: product.metrics.conversionRate
    });
    setLocalFeatures({
      title_quality: product.metrics.titleQuality,
      keyword_score: product.metrics.keywordScore,
      rating: product.metrics.rating,
      reviews: product.metrics.reviews,
      visits: product.metrics.visits,
      ctr: product.metrics.ctr,
      time_on_page: product.metrics.timeOnPage,
      scroll_depth: product.metrics.scrollDepth,
      add_to_cart_rate: product.metrics.addToCartRate,
      conversion_rate: product.metrics.conversionRate,
      description_length: product.metrics.descriptionLength,
    });
  };

  const updateFeature = (key: string, value: number) => {
    if (!localFeatures) return;
    const newFeatures = { ...localFeatures, [key]: value };
    setLocalFeatures(newFeatures);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    
    debounceTimerRef.current = setTimeout(async () => {
      setIsSimulating(true);
      try {
        const payload = { ...newFeatures, cluster_label: simResult?.new_cluster || "Unknown" };
        const res = await fetch('/api/product/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-shopify-domain': shop, 'x-shopify-token': token },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          setSimResult(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSimulating(false);
      }
    }, 150);
  };

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filteredProducts = useMemo(
    () => products.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())),
    [products, searchQuery]
  );

  // Cluster summary stats
  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      counts[p.analysis.cluster] = (counts[p.analysis.cluster] || 0) + 1;
    });
    return counts;
  }, [products]);

  useEffect(() => {
    const handleRefresh = () => fetchProducts();
    window.addEventListener('refresh-level-4', handleRefresh);
    return () => window.removeEventListener('refresh-level-4', handleRefresh);
  }, [fetchProducts]);

  const avgScore = useMemo(
    () => products.length ? Math.round(products.reduce((s, p) => s + p.analysis.score, 0) / products.length) : 0,
    [products]
  );

  if (loading) {
    return (
      <Page fullWidth>
        <Card>
            <Box padding="800">
              <BlockStack inlineAlign="center" gap="400">
                <Spinner size="large" />
                <Text as="p" alignment="center">{t('cluster.analyzing')}</Text>
              </BlockStack>
            </Box>
        </Card>
      </Page>
    );
  }

  return (
    <Page fullWidth>
      <BlockStack gap="400">
          {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}



          {/* Main Two-Column Layout */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            
            {/* Left Column: Product inventory list */}
            <div style={{ flex: '0 0 35%', minWidth: 0 }}>
              <BlockStack gap="400">
                {/* Compact summary stats */}
                <Card>
                  <InlineStack gap="400" align="space-around" blockAlign="center">
                    <BlockStack gap="050" inlineAlign="center">
                      <Text as="p" variant="headingLg">{products.length}</Text>
                      <Text as="p" tone="subdued" variant="bodySm">{t('cluster.products')}</Text>
                    </BlockStack>
                    <div style={{ width: 1, height: 32, backgroundColor: 'var(--p-color-border-secondary)' }} />
                    <BlockStack gap="050" inlineAlign="center">
                      <Text as="p" variant="headingLg">{avgScore}</Text>
                      <Text as="p" tone="subdued" variant="bodySm">{t('cluster.avgScore')}</Text>
                    </BlockStack>
                    <div style={{ width: 1, height: 32, backgroundColor: 'var(--p-color-border-secondary)' }} />
                    <BlockStack gap="050" inlineAlign="center">
                      <Text as="p" variant="headingLg" tone="critical">
                        {products.filter(p => p.analysis.score < 70).length}
                      </Text>
                      <Text as="p" tone="subdued" variant="bodySm">{t('cluster.toImprove')}</Text>
                    </BlockStack>
                  </InlineStack>
                </Card>

                <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">{t('cluster.yourProducts')}</Text>
                    <div style={{ width: 140 }}>
                      <TextField
                        label="Search"
                        labelHidden
                        placeholder={t('cluster.search')}
                        value={searchQuery}
                        onChange={setSearchQuery}
                        autoComplete="off"
                        size="slim"
                      />
                    </div>
                  </InlineStack>
                  <Divider />
                  <div style={{ height: 'calc(100vh - 230px)', overflowY: 'auto', paddingRight: '4px' }}>
                    <BlockStack gap="200">
                      {filteredProducts.map(p => {
                        const isActive = selectedProduct?.id === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProduct(p)}
                            style={{
                              cursor: 'pointer',
                              padding: '12px',
                              borderRadius: 10,
                              border: isActive 
                                ? `2px solid ${CLUSTER_COLORS[p.analysis.cluster]}` 
                                : `1px solid ${CLUSTER_COLORS[p.analysis.cluster]}60`, // 60 for partial transparency
                              background: isActive ? 'var(--p-color-bg-surface-selected)' : 'var(--p-color-bg-surface)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.title}
                                  style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <div style={{
                                  width: 48, height: 48, borderRadius: 6,
                                  background: 'var(--p-color-bg-surface-secondary)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, color: 'var(--p-color-text-subdued)', flexShrink: 0
                                }}>No img</div>
                              )}
                              
                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center', minHeight: 48 }}>
                                <Text as="p" variant="bodyMd" fontWeight="semibold" truncate>{p.title}</Text>
                                <Text as="p" variant="bodySm" tone="subdued">
                                  ${p.price.toFixed(2)} · Score: {p.analysis.score}
                                </Text>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filteredProducts.length === 0 && (
                        <Box padding="400">
                          <Text as="p" alignment="center" tone="subdued">{t('cluster.noProducts')}</Text>
                        </Box>
                      )}
                    </BlockStack>
                  </div>
                </BlockStack>
              </Card>
              </BlockStack>
            </div>

            {/* Right Column: Cluster scatter chart + Info + Sliders */}
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <BlockStack gap="400">
                {/* Graph */}
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">{t('cluster.clusterMap')}</Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'flex-end' }}>
                        {Object.entries(CLUSTER_COLORS).map(([name, color]) => (
                          <InlineStack key={name} gap="100" blockAlign="center">
                            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
                            <Text as="span" variant="bodySm" tone="subdued">{name}</Text>
                          </InlineStack>
                        ))}
                      </div>
                    </InlineStack>
                    <div style={{ width: '100%', height: 260, position: 'relative' }}>
                      {isSimulating && (
                        <div style={{ position: 'absolute', top: 10, right: 10 }}>
                          <Spinner size="small" />
                        </div>
                      )}
                      <ScatterChart
                        products={products}
                        selectedId={selectedProduct?.id || null}
                        simResult={simResult}
                        onSelect={handleSelectProduct}
                      />
                    </div>
                  </BlockStack>
                </Card>

                {/* Selected Product Deep Dive & Sliders */}
                {selectedProduct ? (
                  <Card>
                    <BlockStack gap="400">


                      {/* Content: Sliders then Metrics */}
                      <BlockStack gap="400">
                        {/* Sliders (2x2 Grid) */}
                        <BlockStack gap="100">
                          <Text as="h3" variant="headingSm">{t('cluster.simulate')}</Text>
                          {localFeatures && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <RangeSlider
                                label={`Title Quality: ${localFeatures.title_quality}/10`}
                                value={localFeatures.title_quality}
                                min={1} max={10} step={1}
                                onChange={(v) => updateFeature('title_quality', v)}
                                output
                              />
                              <RangeSlider
                                label={`Keyword Score: ${localFeatures.keyword_score}/10`}
                                value={localFeatures.keyword_score}
                                min={1} max={10} step={1}
                                onChange={(v) => updateFeature('keyword_score', v)}
                                output
                              />
                              <RangeSlider
                                label={`Product Rating: ${localFeatures.rating}/5`}
                                value={localFeatures.rating}
                                min={1} max={5} step={0.1}
                                onChange={(v) => updateFeature('rating', v)}
                                output
                              />
                              <RangeSlider
                                label={`Reviews: ${localFeatures.reviews}`}
                                value={localFeatures.reviews}
                                min={0} max={2000} step={10}
                                onChange={(v) => updateFeature('reviews', v)}
                                output
                              />
                            </div>
                          )}
                        </BlockStack>

                        {/* Banner */}
                        {simResult && simResult.new_cluster !== selectedProduct.analysis.cluster && (
                          <Banner tone="success">
                            <p>If you implement these changes, your product would likely move to the <strong>{simResult.new_cluster}</strong> cluster!</p>
                          </Banner>
                        )}

                        {/* Dynamic Metrics Grid */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 4
                        }}>
                          {[
                            { label: 'Visibility', value: `${((simResult ? simResult.visibility_score : selectedProduct.coordinates.x) * 100).toFixed(0)}/100` },
                            { label: 'Confidence', value: `${((simResult ? simResult.confidence_score : selectedProduct.coordinates.y) * 100).toFixed(0)}/100` },
                            { label: 'Proj. CVR', value: `${((simResult ? simResult.new_conversion_rate : selectedProduct.metrics.conversionRate) * 100).toFixed(1)}%` },
                            { label: 'CTR', value: `${(selectedProduct.metrics.ctr * 100).toFixed(1)}%` },
                          ].map(m => (
                            <div key={m.label} style={{
                              padding: 12, borderRadius: 8,
                              background: 'var(--p-color-bg-surface-secondary)',
                            }}>
                              <Text as="p" variant="bodySm" tone="subdued">{m.label}</Text>
                              <Text as="p" variant="headingMd">{m.value}</Text>
                            </div>
                          ))}
                        </div>
                      </BlockStack>
                    </BlockStack>
                  </Card>
                ) : (
                  <Card>
                    <Box padding="800">
                      <BlockStack gap="300" inlineAlign="center">
                        <Text as="h3" variant="headingMd" alignment="center">{t('cluster.noSelected')}</Text>
                        <Text as="p" tone="subdued" alignment="center">
                          Click on a product from the list on the left to view deep-dive metrics, strengths, weaknesses, and access the interactive simulation sliders.
                        </Text>
                      </BlockStack>
                    </Box>
                  </Card>
                )}
              </BlockStack>
            </div>
          </div>
      </BlockStack>
    </Page>
  );
};
