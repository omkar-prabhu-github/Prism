import React, { useState } from 'react';
import {
  Page, Card, BlockStack, TextField, Button, Text,
  Banner, InlineStack, Box, Checkbox
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { VoiceHint } from '../../../hooks/useVoiceFeedback';

interface Props { onBack: () => void; }

const DATA_TYPES = ['Email address', 'Phone number', 'Shipping address', 'Browsing history'];

export const PolicyPage: React.FC<Props> = ({ onBack }) => {
  const { shop, token } = useDashboard();
  const [businessName, setBusinessName] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('5-7');
  const [returnWindow, setReturnWindow] = useState('30');
  const [contactEmail, setContactEmail] = useState('');
  const [region, setRegion] = useState('United States');
  const [dataCollection, setDataCollection] = useState<string[]>(['Email address', 'Shipping address']);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const toggleData = (type: string) => {
    setDataCollection(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleGenerate = async () => {
    if (!businessName || !contactEmail) {
      setError('Please provide your business name and contact email.');
      return;
    }
    setGenerating(true); setError(''); setSuccessMsg('');

    try {
      const res = await fetch('/api/policy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shopify-domain': shop, 'x-shopify-token': token },
        body: JSON.stringify({ businessName, deliveryDays, returnWindow, contactEmail, region, dataCollection }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to generate policies');

      setSuccessMsg('Success! Privacy, Shipping, Refund, and Terms pages have been published.');
    } catch (err: any) {
      setError(err.message);
    }
    setGenerating(false);
  };

  return (
    <Page backAction={{ content: 'Home', onAction: onBack }} title="Setup Store Policies">
      <div className="simplified-container">
        <BlockStack gap="400">
          {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}
          {successMsg && <div id="tour-success-policy"><Banner tone="success" onDismiss={() => setSuccessMsg('')}><p>{successMsg}</p></Banner></div>}

          <Card>
            <BlockStack gap="400">
              <div id="tour-step-policy-form">
                <Box paddingBlockStart="100">
                  <BlockStack gap="300">
                    <div id="tour-field-business">
                      <VoiceHint label="Business or Store Name">
                        <TextField label="Business or Store Name" value={businessName} onChange={setBusinessName} autoComplete="off" />
                      </VoiceHint>
                    </div>
                    <div id="tour-field-email">
                      <VoiceHint label="Customer Support Email">
                        <TextField label="Customer Support Email" type="email" value={contactEmail} onChange={setContactEmail} autoComplete="email" />
                      </VoiceHint>
                    </div>
                    
                    <InlineStack gap="300">
                      <VoiceHint label="Delivery Time" style={{ flex: 1 }}><TextField label="Delivery Time (Days)" value={deliveryDays} onChange={setDeliveryDays} autoComplete="off" /></VoiceHint>
                      <VoiceHint label="Return Window" style={{ flex: 1 }}><TextField label="Return Window (Days)" value={returnWindow} onChange={setReturnWindow} autoComplete="off" /></VoiceHint>
                    </InlineStack>

                    <VoiceHint label="Region or Country">
                      <TextField label="Region / Country" value={region} onChange={setRegion} autoComplete="country" />
                    </VoiceHint>
                    
                    <Box paddingBlockStart="100">
                      <Text as="p" fontWeight="bold">What data do you collect?</Text>
                      <Box paddingBlockStart="100">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {DATA_TYPES.map(type => (
                            <VoiceHint key={type} label={type}>
                              <Checkbox
                                label={type}
                                checked={dataCollection.includes(type)}
                                onChange={() => toggleData(type)}
                              />
                            </VoiceHint>
                          ))}
                        </div>
                      </Box>
                    </Box>
                  </BlockStack>
                </Box>
              </div>
            </BlockStack>
          </Card>

          <VoiceHint label="Generate and Publish All Policies">
            <div id="tour-step-policy-generate">
              <Button size="large" variant="primary" fullWidth loading={generating} onClick={handleGenerate}>
                Generate & Publish All Policies
              </Button>
            </div>
          </VoiceHint>
        </BlockStack>
      </div>
    </Page>
  );
};
