import React, { useState, useCallback, useRef } from 'react';
import {
  Page, Card, BlockStack, TextField, Button, DropZone,
  Text, Banner, InlineStack, Box, Divider, Spinner,
} from '@shopify/polaris';
import { NoteIcon } from '@shopify/polaris-icons';
import { useDashboard } from '../DashboardContext';
import { VoiceHint } from '../../../hooks/useVoiceFeedback';

interface Props { onBack: () => void; }

export const ProductUploadPage: React.FC<Props> = ({ onBack }) => {
  const { shop, token } = useDashboard();
  const [file, setFile] = useState<File | null>(null);
  const [base64, setBase64] = useState<string>('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [inventory, setInventory] = useState('1');

  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [generatedId, setGeneratedId] = useState<number | null>(null);
  const [generatedData, setGeneratedData] = useState<any>(null);

  const handleDrop = useCallback((dropFiles: File[]) => {
    const f = dropFiles[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onloadend = () => setBase64(reader.result as string);
      reader.readAsDataURL(f);
    }
  }, []);

  const handleGenerate = async () => {
    if (!name || !price) {
      setError('Please provide at least a name and price.');
      return;
    }
    setGenerating(true);
    setError('');
    setSuccessMsg('');

    try {
      const genRes = await fetch('/api/product/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shopify-domain': shop, 'x-shopify-token': token },
        body: JSON.stringify({ name, category, price, imageBase64: base64 }),
      });
      const genData = await genRes.json();
      if (!genRes.ok || !genData.ok) throw new Error(genData.error || 'Failed to generate content');

      setGeneratedData(genData.generated);
    } catch (err: any) {
      setError(err.message);
    }
    setGenerating(false);
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    try {
      const pubRes = await fetch('/api/product/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shopify-domain': shop, 'x-shopify-token': token },
        body: JSON.stringify({
          ...generatedData,
          price, imageBase64: base64, category, inventory
        }),
      });
      const pubData = await pubRes.json();
      if (!pubRes.ok || !pubData.ok) throw new Error(pubData.error || 'Failed to publish to Shopify');

      setSuccessMsg(`Success! Created product: ${generatedData.title}`);
      setGeneratedId(pubData.product?.id || null);
      setGeneratedData(null);
    } catch (err: any) {
      setError(err.message);
    }
    setPublishing(false);
  };

  const openInShopify = () => {
    if (generatedId) window.open(`https://${shop}/admin/products/${generatedId}`, '_blank');
  };

  const reset = () => {
    setFile(null); setBase64(''); setName(''); setPrice(''); setCategory(''); setInventory('1');
    setSuccessMsg(''); setGeneratedId(null);
  };

  if (successMsg) {
    return (
      <Page backAction={{ content: 'Home', onAction: onBack }} title="Product Added">
        <div className="simplified-container">
          <Card>
            <BlockStack gap="400" inlineAlign="center">
              <Box padding="400">
                <div id="tour-success-product"><Banner tone="success"><p>{successMsg}</p></Banner></div>
              </Box>
              <InlineStack gap="300">
                <Button onClick={reset}>Add Another</Button>
                {generatedId && <Button variant="primary" onClick={openInShopify}>View in Shopify</Button>}
              </InlineStack>
            </BlockStack>
          </Card>
        </div>
      </Page>
    );
  }

  if (generatedData) {
    return (
      <Page backAction={{ content: 'Back', onAction: () => setGeneratedData(null) }} title="Review Product">
        <div className="simplified-container">
          <BlockStack gap="400">
            {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">AI Generated Content</Text>
                <Divider />
                
                {base64 && (
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <img src={base64} alt="Product preview" style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }} />
                  </div>
                )}

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm" fontWeight="bold">Title</Text>
                  <Text as="p">{generatedData.title}</Text>
                  
                  <Text as="h3" variant="headingSm" fontWeight="bold">Description</Text>
                  <div style={{ background: '#f4f6f8', padding: '12px', borderRadius: '8px' }} dangerouslySetInnerHTML={{ __html: generatedData.bodyHtml }} />

                  <Text as="h3" variant="headingSm" fontWeight="bold">SEO Tags</Text>
                  <Text as="p">{generatedData.tags}</Text>
                </BlockStack>
              </BlockStack>
            </Card>

            <InlineStack gap="300" align="end">
              <Button onClick={() => setGeneratedData(null)}>Cancel</Button>
              <div id="tour-step-publish">
                <VoiceHint label="Publish Product">
                  <Button variant="primary" loading={publishing} onClick={handlePublish}>Publish to Shopify</Button>
                </VoiceHint>
              </div>
            </InlineStack>
          </BlockStack>
        </div>
      </Page>
    );
  }

  return (
    <Page backAction={{ content: 'Home', onAction: onBack }} title="Add Product">
      <div className="simplified-container">
        <BlockStack gap="400">
          {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}

          <Card>
            <BlockStack gap="400">
              <VoiceHint label="Add Photo">
                <div id="tour-step-image">
                  <Text as="h2" variant="headingMd">1. Add Photo</Text>
                  <Box paddingBlockStart="200">
                    <DropZone accept="image/*" type="image" onDrop={handleDrop} allowMultiple={false}>
                      {file ? (
                        <BlockStack inlineAlign="center" gap="200">
                          <img src={base64} alt="preview" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }} />
                          <Text as="p" tone="subdued">{file.name}</Text>
                        </BlockStack>
                      ) : (
                        <DropZone.FileUpload />
                      )}
                    </DropZone>
                  </Box>
                </div>
              </VoiceHint>

              <Divider />

              <div id="tour-step-details">
                <Text as="h2" variant="headingMd">2. Basics</Text>
                <Box paddingBlockStart="200">
                  <BlockStack gap="300">
                    <div id="tour-field-name">
                      <VoiceHint label="Name">
                        <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
                      </VoiceHint>
                    </div>
                    <InlineStack gap="300">
                      <div id="tour-field-price" style={{ flex: 1 }}>
                        <VoiceHint label="Price">
                          <TextField label="Price" inputMode="decimal" prefix="$" value={price} onChange={setPrice} autoComplete="off" />
                        </VoiceHint>
                      </div>
                      <div id="tour-field-category" style={{ flex: 1 }}>
                        <VoiceHint label="Category">
                          <TextField label="Category (optional)" value={category} onChange={setCategory} autoComplete="off" />
                        </VoiceHint>
                      </div>
                      <div id="tour-field-inventory" style={{ flex: 1 }}>
                        <VoiceHint label="Inventory">
                          <TextField label="Inventory" inputMode="numeric" value={inventory} onChange={setInventory} autoComplete="off" />
                        </VoiceHint>
                      </div>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </div>
            </BlockStack>
          </Card>

          <VoiceHint label="Create Product with AI">
            <div id="tour-step-generate">
              <Button size="large" variant="primary" fullWidth loading={generating} onClick={handleGenerate}>
                Create Product with AI
              </Button>
            </div>
          </VoiceHint>
        </BlockStack>
      </div>
    </Page>
  );
};
