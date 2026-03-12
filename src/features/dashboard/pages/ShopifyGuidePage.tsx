import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Page, Card, Text, Button, BlockStack, InlineStack,
  Box, Banner, Spinner, Divider, Badge, TextField, Icon,
} from '@shopify/polaris';
import { SearchIcon, CheckCircleIcon, AlertTriangleIcon } from '@shopify/polaris-icons';

/* ── Types ── */
interface GuideStep {
  number: number;
  instruction: string;
  detail: string;
}

interface GuideResult {
  title: string;
  summary: string;
  steps: GuideStep[];
  totalSteps: number;
}

type ExtensionStatus = 'idle' | 'checking' | 'connected' | 'not_found';
type VisualizeStatus = 'idle' | 'capturing' | 'analyzing' | 'highlighting' | 'waiting_click' | 'complete' | 'error';

/* ── Extension bridge (postMessage to parent for the Chrome extension content-script) ── */
const EXTENSION_ID = 'prism-shopify-guide';

function sendToExtension(payload: Record<string, unknown>) {
  // Post to parent window where the content-script lives
  window.parent.postMessage({ source: EXTENSION_ID, ...payload }, '*');
}

/* ── Component ── */
export const ShopifyGuidePage: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guide, setGuide] = useState<GuideResult | null>(null);

  const [extStatus, setExtStatus] = useState<ExtensionStatus>('idle');
  const [vizStatus, setVizStatus] = useState<VisualizeStatus>('idle');
  const [vizStep, setVizStep] = useState(0);
  const [vizInstruction, setVizInstruction] = useState('');
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const extPingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Listen for messages from extension content-script ── */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.source !== EXTENSION_ID) return;
      const { type } = e.data;

      switch (type) {
        case 'PONG':
          setExtStatus('connected');
          if (extPingTimeout.current) clearTimeout(extPingTimeout.current);
          break;
        case 'STATUS':
          setVizStatus(e.data.status);
          if (e.data.currentStep !== undefined) setVizStep(e.data.currentStep);
          if (e.data.instruction) setVizInstruction(e.data.instruction);
          if (e.data.completedSteps) setCompletedSteps(e.data.completedSteps);
          break;
        case 'COMPLETE':
          setVizStatus('complete');
          break;
        case 'ERROR':
          setVizStatus('error');
          setError(e.data.message || 'Extension encountered an error');
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  /* ── Check extension availability ── */
  const checkExtension = useCallback(() => {
    setExtStatus('checking');
    sendToExtension({ type: 'PING' });
    extPingTimeout.current = setTimeout(() => {
      setExtStatus('not_found');
    }, 2000);
  }, []);

  /* ── Ask question ── */
  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    setGuide(null);
    setVizStatus('idle');
    setVizStep(0);
    setCompletedSteps([]);

    try {
      const res = await fetch('/api/guide/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
      const data: GuideResult = await res.json();
      setGuide(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate guide');
    } finally {
      setLoading(false);
    }
  };

  /* ── Start visualize flow ── */
  const handleVisualize = () => {
    if (!guide) return;
    checkExtension();
    // Wait a moment for extension pong, then start
    setTimeout(() => {
      setVizStatus('capturing');
      setVizStep(1);
      setCompletedSteps([]);
      sendToExtension({
        type: 'START_GUIDE',
        question,
        steps: guide.steps,
        backendUrl: window.location.origin,
      });
    }, 500);
  };

  /* ── Stop visualize ── */
  const handleStopVisualize = () => {
    sendToExtension({ type: 'STOP_GUIDE' });
    setVizStatus('idle');
    setVizStep(0);
  };

  /* ── Suggestion chips ── */
  const suggestions = [
    'How do I delete a product?',
    'How to add a discount code?',
    'How to change my store name?',
    'How to add a new collection?',
    'How to edit shipping rates?',
    'How to set up a refund policy?',
  ];

  /* ── Render ── */
  return (
    <Page title="Shopify Guide">
      <div className="axiom-fade-in simplified-container" style={{ maxWidth: 700 }}>
        <BlockStack gap="500">

          {/* Header */}
          <Box paddingBlockEnd="200">
            <BlockStack gap="200" inlineAlign="center">
              <Badge tone="info">AI-Powered</Badge>
              <Text as="h2" variant="headingXl" alignment="center">
                How can I help you?
              </Text>
              <Text as="p" variant="bodyLg" tone="subdued" alignment="center">
                Ask any question about managing your Shopify store.
              </Text>
            </BlockStack>
          </Box>

          {/* Search Input */}
          <Card>
            <BlockStack gap="400">
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Search"
                    labelHidden
                    placeholder="e.g. How do I delete a product?"
                    value={question}
                    onChange={setQuestion}
                    autoComplete="off"
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' && !loading) handleAsk();
                    }}
                    connectedRight={
                      <Button
                        variant="primary"
                        onClick={handleAsk}
                        loading={loading}
                        disabled={!question.trim()}
                        icon={SearchIcon}
                      >
                        Ask
                      </Button>
                    }
                  />
                </div>
              </div>

              {/* Suggestion Chips */}
              {!guide && !loading && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setQuestion(s); }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: '1px solid var(--p-color-border)',
                        background: 'var(--p-color-bg-surface)',
                        color: 'var(--p-color-text)',
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.background = 'var(--p-color-bg-surface-hover)';
                        (e.target as HTMLElement).style.borderColor = 'var(--p-color-border-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.background = 'var(--p-color-bg-surface)';
                        (e.target as HTMLElement).style.borderColor = 'var(--p-color-border)';
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </BlockStack>
          </Card>

          {/* Error */}
          {error && (
            <Banner tone="critical" onDismiss={() => setError('')}>
              <p>{error}</p>
            </Banner>
          )}

          {/* Loading */}
          {loading && (
            <Card>
              <Box padding="800">
                <BlockStack gap="300" align="center" inlineAlign="center">
                  <Spinner size="large" />
                  <Text as="p" variant="bodyMd">Generating step-by-step guide…</Text>
                  <Text as="p" variant="bodySm" tone="subdued">This usually takes a few seconds.</Text>
                </BlockStack>
              </Box>
            </Card>
          )}

          {/* Steps Result */}
          {guide && !loading && (
            <div className="axiom-fade-in">
              <Card>
                <BlockStack gap="400">
                  {/* Title */}
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">{guide.title}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">{guide.summary}</Text>
                    </BlockStack>
                    <Badge>{guide.totalSteps} steps</Badge>
                  </InlineStack>

                  <Divider />

                  {/* Step List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {guide.steps.map((step, idx) => {
                      const isDone = completedSteps.includes(step.instruction) || vizStep > step.number;
                      const isCurrent = vizStatus !== 'idle' && vizStep === step.number;

                      return (
                        <div
                          key={step.number}
                          style={{
                            display: 'flex',
                            gap: 12,
                            padding: '14px 12px',
                            borderRadius: 10,
                            background: isCurrent
                              ? 'var(--p-color-bg-surface-info)'
                              : idx % 2 === 0
                              ? 'transparent'
                              : 'var(--p-color-bg-surface-secondary)',
                            transition: 'background 0.2s ease',
                          }}
                        >
                          {/* Step Number / Check */}
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontSize: 14, fontWeight: 600,
                            background: isDone
                              ? 'var(--p-color-bg-fill-success)'
                              : isCurrent
                              ? 'var(--p-color-bg-fill-info)'
                              : 'var(--p-color-bg-fill-secondary)',
                            color: isDone || isCurrent ? '#fff' : 'var(--p-color-text)',
                            transition: 'all 0.3s ease',
                          }}>
                            {isDone ? '✓' : step.number}
                          </div>

                          {/* Instruction */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text as="p" variant="bodyMd" fontWeight={isCurrent ? 'semibold' : 'regular'}>
                              {step.instruction}
                            </Text>
                            {step.detail && (
                              <Box paddingBlockStart="100">
                                <Text as="p" variant="bodySm" tone="subdued">{step.detail}</Text>
                              </Box>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Divider />

                  {/* Visualize Button */}
                  <InlineStack align="center" gap="300">
                    {vizStatus === 'idle' && (
                      <Button variant="primary" tone="success" onClick={handleVisualize} size="large">
                        🎯 Visualize on Screen
                      </Button>
                    )}
                    {vizStatus !== 'idle' && vizStatus !== 'complete' && (
                      <Button variant="primary" tone="critical" onClick={handleStopVisualize}>
                        ✕ Stop Guide
                      </Button>
                    )}
                    {vizStatus === 'complete' && (
                      <Banner tone="success">
                        <p>✅ All steps completed! You've successfully finished the task.</p>
                      </Banner>
                    )}
                  </InlineStack>

                  {/* Visualize Status */}
                  {vizStatus !== 'idle' && vizStatus !== 'complete' && (
                    <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                      <InlineStack gap="200" blockAlign="center">
                        {(vizStatus === 'capturing' || vizStatus === 'analyzing') && <Spinner size="small" />}
                        <Text as="p" variant="bodySm">
                          {vizStatus === 'capturing' && '📸 Taking screenshot…'}
                          {vizStatus === 'analyzing' && '🤖 AI is finding the next element…'}
                          {vizStatus === 'highlighting' && `🎯 Step ${vizStep}: ${vizInstruction}`}
                          {vizStatus === 'waiting_click' && `👆 Click the highlighted element — ${vizInstruction}`}
                          {vizStatus === 'error' && `❌ ${vizInstruction || 'Something went wrong. Try again.'}`}
                        </Text>
                      </InlineStack>
                    </Box>
                  )}
                </BlockStack>
              </Card>
            </div>
          )}



          <Box paddingBlockEnd="800" />
        </BlockStack>
      </div>
    </Page>
  );
};
