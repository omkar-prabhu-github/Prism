import React, { useState } from 'react';
import {
  Page, Card, BlockStack, TextField, Button, Text,
  Banner, InlineStack, Box, Spinner
} from '@shopify/polaris';
import { useDashboard } from '../DashboardContext';
import { VoiceHint } from '../../../hooks/useVoiceFeedback';

interface Props { onBack: () => void; }

const SUGGESTIONS = ['Top 10 Gift Ideas', 'How to Use Our Products', 'Behind the Scenes', 'Why Quality Matters'];

export const BlogPostPage: React.FC<Props> = ({ onBack }) => {
  const { shop, token } = useDashboard();
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleGenerate = async () => {
    if (!topic) {
      setError('Please enter a topic.');
      return;
    }
    setGenerating(true); setError(''); setSuccessMsg('');

    try {
      const res = await fetch('/api/blog/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shopify-domain': shop, 'x-shopify-token': token },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to generate blog');

      setSuccessMsg(`Success! Blog created: "${data.article.title}"`);
      setTopic('');
    } catch (err: any) {
      setError(err.message);
    }
    setGenerating(false);
  };

  return (
    <Page backAction={{ content: 'Home', onAction: onBack }} title="Write a Blog Post">
      <div className="simplified-container">
        <BlockStack gap="400">
          {error && <Banner tone="critical" onDismiss={() => setError('')}><p>{error}</p></Banner>}
          {successMsg && <div id="tour-success-blog"><Banner tone="success" onDismiss={() => setSuccessMsg('')}><p>{successMsg}</p></Banner></div>}

          <Card>
            <BlockStack gap="400">
              <VoiceHint label="Topic">
                <div id="tour-step-blog-topic">
                  <Text as="h2" variant="headingMd">What should the article be about?</Text>
                  <Box paddingBlockStart="200">
                    <TextField
                      label="Topic"
                      labelHidden
                      value={topic}
                      onChange={setTopic}
                      autoComplete="off"
                      multiline={3}
                    />
                  </Box>
                  
                  <Box paddingBlockStart="300">
                    <Text as="p" tone="subdued">Or pick a suggestion:</Text>
                    <Box paddingBlockStart="100">
                      <InlineStack gap="200">
                        {SUGGESTIONS.map(s => (
                          <VoiceHint key={s} label={s}>
                            <Button size="micro" onClick={() => setTopic(s)}>{s}</Button>
                          </VoiceHint>
                        ))}
                      </InlineStack>
                    </Box>
                  </Box>
                </div>
              </VoiceHint>
            </BlockStack>
          </Card>

          <VoiceHint label="Write Article with AI">
            <div id="tour-step-blog-generate">
              <Button size="large" variant="primary" fullWidth loading={generating} onClick={handleGenerate}>
                Write Article with AI
              </Button>
            </div>
          </VoiceHint>
        </BlockStack>
      </div>
    </Page>
  );
};
