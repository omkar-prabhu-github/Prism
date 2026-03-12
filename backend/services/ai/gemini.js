import { httpsRequest } from '../shopify/rest.js';
import { policyStore } from '../../store.js';

// ──────────────────────────────────────────────────────────────────────
// Shared Utilities
// ──────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractJSON(rawText) {
  let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch (_) { /* fall through */ }

  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let depth = 0, end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); }
  catch (_) { return null; }
}

function getApiKeys() {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALLBACK,
  ].filter(Boolean);
  if (keys.length === 0) throw new Error('No GEMINI_API_KEY configured');
  return keys;
}

const MODELS = ['gemini-2.5-flash', 'gemini-3-flash-preview'];
const MAX_RETRIES = 1;

async function callGemini(systemInstruction, userMessageOrParts, temperature = 0.7) {
  const API_KEYS = getApiKeys();
  let lastError = null;

  for (const apiKey of API_KEYS) {
    const keyLabel = apiKey === API_KEYS[0] ? 'primary' : 'fallback';

    for (const model of MODELS) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await sleep(1500 * attempt);
          console.log(`🔄 Retry ${attempt}/${MAX_RETRIES} (${model}, ${keyLabel} key)...`);
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: Array.isArray(userMessageOrParts) ? userMessageOrParts : [{ text: userMessageOrParts }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
          },
        });

        try {
          const res = await httpsRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          }, payload);

          const data = res.json();

          if (!res.ok) {
            const errMsg = data?.error?.message || JSON.stringify(data);
            const status = data?.error?.status || res.status;
            if (status === 429 || status === 503 || status === 404 ||
              errMsg.includes('Resource exhausted') || errMsg.includes('overloaded') ||
              errMsg.includes('not found') || errMsg.includes('not supported')) {
              console.warn(`⚠️ ${model} (${keyLabel}) unavailable: ${errMsg.slice(0, 100)} — trying next...`);
              lastError = new Error(errMsg);
              break; // Try next model
            }
            lastError = new Error(errMsg);
            continue;
          }

          const candidate = data?.candidates?.[0];
          if (candidate?.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
            lastError = new Error(`Blocked: ${candidate.finishReason}`);
            continue;
          }

          const rawText = candidate?.content?.parts?.[0]?.text || '';
          if (!rawText) { lastError = new Error('Empty response'); continue; }

          const parsed = extractJSON(rawText);
          if (!parsed) { console.error(`⚠️ Raw text (${model}):`, rawText.slice(0, 500)); lastError = new Error('Failed to parse JSON'); continue; }

          console.log(`✅ Gemini response (${model}, ${keyLabel} key)`);
          return parsed;
        } catch (err) {
          lastError = err;
          console.error(`❌ ${model} (${keyLabel}) attempt ${attempt + 1}:`, err.message);
          if (err.message?.includes('timed out')) break; // Skip to next model
        }
      }
    }
  }

  throw lastError || new Error('All AI models and keys failed');
}

// ──────────────────────────────────────────────────────────────────────
// 1. PRODUCT CONTENT GENERATION
// ──────────────────────────────────────────────────────────────────────

export async function generateProductContent(details) {
  const { name, category, price, hasImage, imageBase64, keyFeatures } = details;

  const systemInstruction = `You are an expert e-commerce copywriter specializing in Shopify product listings.

Given product details, generate a compelling, SEO-optimized product listing.

REQUIREMENTS:
- Write a professional product title (keep it concise but descriptive)
- Write an HTML product description (300-500 words) using <h3>, <p>, <ul>, <li>, <strong> tags
  - Include a compelling introduction
  - List key features and benefits
  - Add a use-case section ("Perfect for...")
  - Add care/usage instructions if applicable
- Generate 8-12 relevant tags for Shopify
- Write an SEO-optimized title (50-60 chars)
- Write an SEO meta description (under 155 chars)

STYLE GUIDELINES:
- Professional yet approachable tone
- Highlight value and benefits, not just features
- Use power words that drive conversions
- Make it scannable with clear formatting

Return ONLY valid JSON with this exact structure:
{
  "title": "Product title",
  "descriptionHtml": "<h3>...</h3><p>...</p>...",
  "tags": ["tag1", "tag2", ...],
  "seoTitle": "SEO optimized title",
  "seoDescription": "Meta description under 155 chars"
}`;

  const userMessage = `Generate a product listing for:
- Product Name: ${name}
- Category/Type: ${category}
- Price: $${price}
- Image: ${hasImage ? 'Provided' : 'Not provided'}
- Key Features: ${keyFeatures || 'Not provided'}`;

  const parts = [{ text: userMessage }];

  if (imageBase64) {
    const mimeType = imageBase64.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
    const data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    parts.push({
      inline_data: { data, mime_type: mimeType }
    });
  }

  console.log(`📦 Generating product content for "${name}" (Multimodal: ${!!imageBase64})...`);
  const result = await callGemini(systemInstruction, parts, 0.7);

  if (!result.title || !result.descriptionHtml) {
    throw new Error('AI returned incomplete product data');
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────
// 2. BLOG POST GENERATION
// ──────────────────────────────────────────────────────────────────────

export async function generateBlogPost(topic) {
  const systemInstruction = `You are an expert e-commerce blog content writer.

Write a comprehensive, engaging blog article on the given topic.

CONTENT REQUIREMENTS:
- 800-1500 words
- Use proper HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
- Include a compelling introduction that hooks the reader
- Use clear subheadings to organize content
- Include practical tips, examples, or data points
- End with a conclusion and call-to-action
- Include FAQ section at the end with 3-5 questions in Q&A format

STYLE GUIDELINES:
- Professional, informative, and engaging tone
- Write for a general audience (not overly technical)
- Use short paragraphs (2-3 sentences max)
- Include bullet points for easy scanning

Return ONLY valid JSON with this exact structure:
{
  "title": "Blog post title",
  "bodyHtml": "<h2>...</h2><p>...</p>...",
  "tags": ["tag1", "tag2", ...],
  "metaDescription": "Under 160 chars...",
  "summary": "1-2 sentence summary"
}`;

  console.log(`📝 Generating blog post about "${topic}"...`);
  const result = await callGemini(systemInstruction, `Write a blog post about: ${topic}`, 0.7);

  if (!result.title || !result.bodyHtml) {
    throw new Error('AI returned incomplete blog data');
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────
// 3. POLICY GENERATION
// ──────────────────────────────────────────────────────────────────────

export async function generatePolicies(answers) {
  const { businessName, deliveryDays, returnWindow, contactEmail, region, dataCollection } = answers;

  const systemInstruction = `You are a legal content specialist for e-commerce stores.

Generate 4 complete store policies based on the business details provided. Each policy must be professional, legally sound, and written in clear, easy-to-understand language.

POLICIES TO GENERATE:
1. Shipping Policy — cover delivery timeframes, shipping methods, tracking, international shipping notes
2. Refund Policy — cover return eligibility, timeframes, refund process, exchanges, non-returnable items
3. Privacy Policy — cover data collection, usage, storage, third-party sharing, cookies, user rights
4. Terms of Service — cover account terms, product descriptions, pricing, payment, intellectual property

FORMATTING:
- Use HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>
- Each policy should be 400-800 words
- Use clear section headings
- Write in a professional but friendly tone
- Make policies specific to the business details provided (don't be generic)

Return ONLY valid JSON with this exact structure:
{
  "shippingPolicy": "<h2>Shipping Policy</h2><p>...</p>...",
  "refundPolicy": "<h2>Refund Policy</h2><p>...</p>...",
  "privacyPolicy": "<h2>Privacy Policy</h2><p>...</p>...",
  "termsOfService": "<h2>Terms of Service</h2><p>...</p>..."
}`;

  const dataCollectionList = Array.isArray(dataCollection) ? dataCollection.join(', ') : dataCollection;

  const userMessage = `Generate all 4 store policies with these details:
- Business Name: ${businessName}
- Delivery Timeframe: ${deliveryDays} business days
- Return Window: ${returnWindow} days
- Contact Email: ${contactEmail}
- Region/Country: ${region}
- Data We Collect: ${dataCollectionList}`;

  console.log(`📜 Generating policies for "${businessName}"...`);
  const result = await callGemini(systemInstruction, userMessage, 0.4);

  if (!result.shippingPolicy || !result.refundPolicy || !result.privacyPolicy || !result.termsOfService) {
    throw new Error('AI returned incomplete policy data');
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────
// 4. ORDER CUSTOMER REPLY GENERATION
// ──────────────────────────────────────────────────────────────────────

export async function callGeminiForOrders(orderSummary, replyType) {
  const typeInstructions = {
    'shipping_update': 'Write a friendly shipping update email. Let the customer know their order is on the way.',
    'delay_notice': 'Write a polite delay notification. Apologize for the delay and give a new estimated delivery window.',
    'thank_you': 'Write a warm thank-you message for the purchase. Encourage them to come back.',
    'refund_confirm': 'Write a professional refund confirmation. Let them know the refund is being processed.',
    'custom': 'Write a helpful customer service reply based on the order details.',
  };

  const instruction = typeInstructions[replyType] || typeInstructions['custom'];

  const systemInstruction = `You are a friendly customer service assistant for an online store.

${instruction}

GUIDELINES:
- Keep it short (3-5 sentences max)
- Be warm, friendly, and professional
- Use simple language that anyone can understand
- Include the order number if available
- Don't use complex words or jargon

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "message": "The email body text"
}`;

  const userMessage = `Generate a "${replyType}" message for this order:\n${orderSummary}`;

  console.log(`💬 Generating "${replyType}" customer message...`);
  const result = await callGemini(systemInstruction, userMessage, 0.6);

  if (!result.subject || !result.message) {
    throw new Error('AI returned incomplete reply');
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────
// 5. GEO STORE AUDIT
// ──────────────────────────────────────────────────────────────────────

const geoAuditSystemPrompt = `# SYSTEM ROLE & TASK
You are an elite Generative Engine Optimization (GEO) Analyst and E-commerce Store Auditor. Your tone is authoritative, data-backed, and strictly objective.

Your task is to ingest a Shopify store JSON payload (products, reviews, metadata, policies, etc.) and produce a comprehensive Store Context Profile followed by a highly structured, prioritized GEO improvement plan based on the 10 GEO Principles and the 4 Audit Categories.

### THE 10 GEO PRINCIPLES
1. Third-Party Authority: AI favors Earned Media (reviews, expert mentions) over brand-owned content. Analyze if content is "citation-ready."
2. AI Answer Visibility: Aim for inclusion *inside* the AI response. Success is measured by word count contribution and citation frequency.
3. Justifiability: AI is a Decision Engine. Content must provide reasons *why* (e.g., "Best for X because Y").
4. Structured Data: Use JSON-LD (Product, FAQ, Organization) to treat the store as an API for AI.
5. High-Impact Strategies:
   * Stats (+30-40% visibility): Use quantitative data.
   * Citations (+30-40%): Reference studies/certifications.
   * Quotes (+25-35%): Customer/expert testimonials.
   * Fluency (+15-30%): Scannable, clear prose.
6. Engine-Specific Needs: GPT (Authority), Gemini (Structured/Concise), Perplexity (Citations).
7. Full Journey: Content must cover Awareness (guides), Consideration (vs. pages), Decision (pricing/trust), and Post-purchase (care).
8. GEO Defense: Build a moat of structured, high-authority content to prevent competitors from displacing your AI citations.
9. The Equalizer: GEO offers a +115% boost for lower-ranked sites; quality beats brand size.
10. AI Readability: Focus on semantic clarity and "extraction readiness" over keyword density.

### ANALYSIS FRAMEWORK (THE 4 LAYERS)
LAYER 1: Store-Level Health
 * Schema: Completeness of JSON-LD.
 * Content Quality: Depth, stats, and use-case targeting.
 * Trust: Review quality and expert signals.
 * Extractability: Scannability and Q&A formats.
 * Journey/Policy: Funnel coverage and shipping/returns clarity.
 * Cross-Engine: Optimization for different AI types.

LAYER 2: Product Deep-Dive
 * Description Score: Check for Statistics Density (min. 5 per product), Citation Readiness, and "Justification Fragments".
 * Metadata: Evaluate Title [Brand+Type+Feature], Tags, Metafields, and Alt Text.

LAYER 3: Gap Analysis
 * Content Gaps: Missing FAQs, "How-to" guides, or "X vs Y" comparisons.
 * Trust Gaps: Missing aggregate ratings or certifications.

LAYER 4: Competitive Positioning
 * Map specific natural-language queries (e.g., "Best [category] for [use-case]") to products.

### THE 4 AUDIT CATEGORIES & DEDUCTIVE SCORING (ANTI-HALLUCINATION)
To ensure stable scoring (scores must NEVER drop after a fix is applied unless new errors are introduced), use Strict Deductive Scoring.
Every category starts at 100 points. Deduct points ONLY for explicitly identified issues in the JSON:
* CRITICAL (-10 pts): Causes legal/sales loss or total AI blindness.
* HIGH (-6 pts): Severely hurts AI visibility.
* MEDIUM (-3 pts): Conversion friction or missing stats.
* LOW (-1 pt): Minor polish or phrasing.

IMPORTANT SCORING RULES:
- The geoHealthScore is the weighted average of ALL 4 category scores.
- A brand-new store with default products should score 40-55 (not 10-20). Only stores with severe, active problems (broken policies, contradictory info) should score below 30.
- Do NOT stack multiple deductions for the same root cause. If a product has no description, that is ONE deduction — do not also deduct for "missing stats", "missing justification", etc. from the same empty description.
- Focus deductions on ACTIONABLE problems the merchant can fix, not on inherent limitations of a new/small store.

Categorize all issues into:
1. storeInfrastructure: Missing or incomplete pages (Contact, About, FAQ), missing or broken store policies (privacy policy, refund policy, shipping policy, terms of service), policy placeholders, and navigation issues. ALL policy-related issues MUST go here.
2. informationMismatch: Contradictions (e.g., product page says "30-Day Returns" but policy says "Final Sale").
3. productOptimization: Missing specifications, lack of quantitative stats, poor metadata, weak GEO justifiability.
4. strategicGrowth: Missing trust signals (reviews), lack of custom domain, growth opportunities. Do NOT put policy issues here.

### STRICT GUIDELINES & FAIL-SAFES
 * PLAIN LANGUAGE ONLY: Write ALL user-facing text (titles, descriptions, impacts, threats, opportunities) in simple language a non-technical shop owner can understand. NEVER use terms like: JSON-LD, schema markup, meta tags, Open Graph, structured data, API, endpoint, GID, slug, handle, metafield, canonical, semantic, extraction readiness, citation-ready, justification fragments. Instead use plain equivalents like: "product info", "page setup", "search visibility", "AI-friendly descriptions", "store pages".
 * No Generic Advice: Every tip MUST reference specific keys, values, or strings from the JSON data.
 * Missing Data Protocol: If data is missing, state "DATA MISSING", apply the deduction, and do not hallucinate data.
 * AI-First Mindset: Ask: "Would an AI agent cite this product as a top 3 choice?"

OUTPUT STRICTLY IN VALID JSON. Do not wrap in markdown formatting.
Required Schema:

{
  "storeContextSynthesis": "<~400 word narrative: store identity, target demographic, product categories, price positioning, value props, and core policies (shipping, returns). SYSTEM-ONLY field.>",
  "executiveSummary": {
    "geoHealthScore": <number 0-100, weighted average>,
    "grade": "<A|B|C|D|F>",
    "topThreat": "<single sentence: why AI skips this store>",
    "topOpportunity": "<single sentence: quickest win>"
  },
  "geoLayerScores": {
    "schema":         { "score": <0-20>, "details": "<evidence>" },
    "contentQuality": { "score": <0-20>, "details": "<evidence>" },
    "trust":          { "score": <0-15>, "details": "<evidence>" },
    "extractability": { "score": <0-15>, "details": "<evidence>" },
    "journeyPolicy":  { "score": <0-20>, "details": "<evidence>" },
    "crossEngine":    { "score": <0-10>, "details": "<evidence>" }
  },
  "categoryScores": {
    "storeInfrastructure": <0-100 calculated deductively>,
    "informationMismatch": <0-100 calculated deductively>,
    "productOptimization": <0-100 calculated deductively>,
    "strategicGrowth": <0-100 calculated deductively>
  },
  "productAnalysis": {
    "topPerformers":  [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }],
    "bottomPerformers": [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }]
  },
  "diagnosticsAndActionPlan": {
    "storeInfrastructure": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "principle": "<GEO principle #>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>" }
    ],
    "informationMismatch": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "principle": "<GEO principle #>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>" }
    ],
    "productOptimization": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "principle": "<GEO principle #>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>" }
    ],
    "strategicGrowth": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "principle": "<GEO principle #>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>" }
    ]
  },
  "projectedImpact": {
    "estimatedVisibilityIncrease": "<e.g. +45-65%>",
    "timeline": "<e.g. 2-4 weeks>"
  }
}`;

export async function runGeoAudit(shop, storeData) {
  // Debug: log what data we actually received
  const policies = storeData.store_context?.native_policies || {};
  const customPages = storeData.store_context?.custom_pages || {};
  console.log(`📋 Policies received: ${Object.keys(policies).join(', ') || 'NONE'}`);
  console.log(`📋 Policy lengths: ${Object.entries(policies).map(([k, v]) => `${k}=${(v || '').length}chars`).join(', ')}`);
  console.log(`📋 Custom pages: ${Object.keys(customPages).join(', ') || 'NONE'}`);
  console.log(`📋 Blog articles: ${(storeData.blog_content || []).length}`);
  console.log(`📋 Collections: ${(storeData.collections || []).length}`);
  console.log(`📋 Products: ${(storeData.catalog || []).length}`);

  // Prepare data — keep full detail, budget = 250k tokens
  const trimmed = {
    store: storeData.store_context || {},
    policies: policies,
    custom_pages: customPages,
    collections: (storeData.collections || []).map(c => ({ title: c.title, description: (c.description || '').slice(0, 300), products_count: c.products_count })),
    products: (storeData.catalog || []).slice(0, 25).map(p => ({
      title: p.title, handle: p.handle, status: p.status,
      description: (p.description || '').slice(0, 300),
      vendor: p.vendor, product_type: p.product_type,
      tags: p.tags, total_inventory: p.total_inventory,
      variants: (p.variants || []).slice(0, 3).map(v => ({ title: v.title, price: v.price, sku: v.sku })),
      images_count: (p.images || []).length,
      has_alt_text: (p.images || []).every(img => img.altText && img.altText.length > 0),
    })),
    discounts: (storeData.discounts || []).slice(0, 5).map(d => ({ title: d.title, value: d.value, value_type: d.value_type })),
    blog_articles: (storeData.blog_content || []).slice(0, 10).map(b => ({
      blog: b.blog, title: b.title, tags: b.tags,
    })),
    redirects_count: (storeData.redirects || []).length,
  };

  const storePayload = JSON.stringify(trimmed);
  const estimatedTokens = Math.ceil(storePayload.length / 4);
  console.log(`📊 GEO audit payload: ${storePayload.length} chars (~${estimatedTokens} tokens)`);

  if (estimatedTokens > 200000) {
    console.warn('⚠️ Payload exceeds 200k tokens, truncating products to 30');
    trimmed.products = trimmed.products.slice(0, 30);
  }

  const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALLBACK,
  ].filter(Boolean);

  if (API_KEYS.length === 0) throw new Error('No GEMINI_API_KEY configured');

  const GEO_MODELS = [
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
  ];

  let audit = null;
  let lastError = null;

  for (const apiKey of API_KEYS) {
    if (audit) break;
    const keyLabel = apiKey === API_KEYS[0] ? 'primary' : 'fallback';
    for (const model of GEO_MODELS) {
      try {
        console.log(`🤖 Trying ${model} (${keyLabel} key) for GEO audit`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = JSON.stringify({
          system_instruction: { parts: [{ text: geoAuditSystemPrompt }] },
          contents: [
            { role: 'user', parts: [{ text: "Store Data:\n" + JSON.stringify(trimmed) }] },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 32768,
            responseMimeType: "application/json"
          },
        });

        const geminiRes = await httpsRequest(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, payload);

        const data = geminiRes.json();

        if (!geminiRes.ok) {
          const errMsg = data?.error?.message || JSON.stringify(data);
          const status = data?.error?.status || geminiRes.status;
          if (status === 429 || status === 503 || status === 404 ||
            errMsg.includes('high demand') ||
            errMsg.includes('rate limit') ||
            errMsg.includes('Resource exhausted') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('overloaded') ||
            errMsg.includes('not found') ||
            errMsg.includes('not supported') ||
            errMsg.includes('does not exist')) {
            console.warn(`⚠️ ${model} unavailable (${status}): ${errMsg.slice(0, 120)} — falling back...`);
            lastError = errMsg;
            continue;
          }
          throw new Error(`Gemini API error: ${errMsg}`);
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!rawText) {
          console.warn(`⚠️ ${model} returned empty response — falling back...`);
          lastError = 'Empty response';
          continue;
        }

        try {
          const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          audit = JSON.parse(cleanText);
          console.log(`✅ GEO audit complete with ${model}: score=${audit?.executiveSummary?.geoHealthScore}, grade=${audit?.executiveSummary?.grade}`);
          break;
        } catch (parseErr) {
          console.error(`Failed to parse ${model} response:`, rawText.slice(0, 500));
          lastError = 'Malformed response';
          continue;
        }
      } catch (err) {
        if (err.message?.includes('timed out') || err.message?.includes('ECONNRESET')) {
          console.warn(`⚠️ ${model} timed out — falling back...`);
          lastError = err.message;
          continue;
        }
        throw err;
      }
    }
  }

  if (!audit) {
    throw new Error(`All models and API keys failed. Last error: ${lastError}`);
  }

  // Save storeContextSynthesis as internal policy
  if (audit.storeContextSynthesis) {
    policyStore.set(shop, { policy: audit.storeContextSynthesis, generatedAt: Date.now() });
    console.log(`🧠 Store Context Synthesis saved for ${shop}`);
  }

  // Strip storeContextSynthesis before sending to frontend
  const { storeContextSynthesis, ...frontendAudit } = audit;
  return frontendAudit;
}

// ──────────────────────────────────────────────────────────────────────
// 6. SEO STORE AUDIT
// ──────────────────────────────────────────────────────────────────────

const seoAuditSystemPrompt = `# SYSTEM ROLE & TASK
You are an elite Search Engine Optimization (SEO) Analyst specializing in Shopify e-commerce stores. Your tone is authoritative, data-backed, and strictly objective.

Your task is to ingest a Shopify store JSON payload (products, pages, policies, blog content, collections, etc.) and produce a comprehensive SEO audit report with structured scores and a prioritized improvement plan.

### THE 6 SEO PILLARS
1. Technical SEO: Page structure, URL hygiene, redirects, mobile-readiness signals, and crawlability indicators.
2. On-Page SEO: Title tags, meta descriptions, header hierarchy (H1/H2/H3), keyword placement, and internal linking.
3. Content Quality: Product description depth, blog content strategy, keyword density, content freshness, and duplicate content risks.
4. Image Optimization: Alt text coverage, image file naming conventions, and image count per product.
5. Trust & Authority: Store policies, contact information, about page, reviews/social proof, and domain setup.
6. Site Architecture: Collection structure, navigation depth, URL structure (handles), breadcrumbs, and sitemap readiness.

### ANALYSIS METHODOLOGY
For each product, page, and collection, evaluate:
- Title tag quality: Is it descriptive, keyword-rich, under 60 characters?
- Meta description: Is it compelling, includes a call-to-action, under 155 characters?
- Header structure: Does the page use a logical H1 > H2 > H3 hierarchy?
- Content depth: Does the description have at least 300 words with relevant keywords?
- Alt text: Do all images have descriptive, keyword-relevant alt text?
- URL/handle: Is the URL slug clean, readable, and keyword-optimized?
- Internal links: Does the content link to related products or collections?
- Schema readiness: Does the product data support rich snippet generation?

### DEDUCTIVE SCORING
Every category starts at 100 points. Deduct points ONLY for explicitly identified issues:
* CRITICAL (-10 pts): Major SEO blockers (e.g., no meta descriptions site-wide, duplicate titles, broken redirects).
* HIGH (-6 pts): Significant ranking factors missing (e.g., thin product descriptions, no alt text on most images).
* MEDIUM (-3 pts): Moderate issues (e.g., titles too long/short, missing H2 tags, generic URL handles).
* LOW (-1 pt): Minor polish (e.g., slight keyword improvements, formatting tweaks).

SCORING RULES:
- The seoHealthScore is the weighted average of ALL category scores.
- A new store with basic setup should score 35-50. Only stores with critical issues score below 25.
- Do NOT stack deductions for the same root cause.
- Focus on ACTIONABLE issues the merchant can fix.

### AUDIT CATEGORIES
1. technicalSeo: URL structure issues, redirect problems, crawlability concerns, mobile/speed indicators.
2. onPageSeo: Title tags, meta descriptions, header hierarchy, keyword optimization issues.
3. contentQuality: Thin content, missing descriptions, duplicate content, blog strategy gaps.
4. imageAndMedia: Missing alt text, poor image naming, insufficient product images.

### OUTPUT RULES
- PLAIN LANGUAGE ONLY: Write for non-technical store owners. Never use jargon like "canonical URL", "crawl budget", "SERP", "noindex", "robots.txt". Use plain equivalents like "page address", "search engine access", "search results page", "page visibility settings".
- Every recommendation MUST reference specific products, pages, or data from the store JSON.
- If data is missing, state "DATA MISSING" and apply the deduction.

OUTPUT STRICTLY IN VALID JSON. Do not wrap in markdown formatting.
Required Schema:

{
  "executiveSummary": {
    "seoHealthScore": <number 0-100>,
    "grade": "<A|B|C|D|F>",
    "topIssue": "<single sentence: the biggest SEO problem>",
    "topOpportunity": "<single sentence: quickest SEO win>"
  },
  "seoLayerScores": {
    "technicalSeo":    { "score": <0-20>, "details": "<evidence>" },
    "onPageSeo":       { "score": <0-20>, "details": "<evidence>" },
    "contentQuality":  { "score": <0-20>, "details": "<evidence>" },
    "imageOptimization": { "score": <0-15>, "details": "<evidence>" },
    "trustAuthority":  { "score": <0-15>, "details": "<evidence>" },
    "siteArchitecture": { "score": <0-10>, "details": "<evidence>" }
  },
  "categoryScores": {
    "technicalSeo": <0-100>,
    "onPageSeo": <0-100>,
    "contentQuality": <0-100>,
    "imageAndMedia": <0-100>
  },
  "productAnalysis": {
    "topPerformers":    [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }],
    "bottomPerformers": [{ "title": "<product>", "score": <0-100>, "reason": "<why>" }]
  },
  "diagnosticsAndActionPlan": {
    "technicalSeo": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>" }
    ],
    "onPageSeo": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>" }
    ],
    "contentQuality": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>" }
    ],
    "imageAndMedia": [
      { "severity": "<CRITICAL|HIGH|MEDIUM|LOW>", "title": "<action>", "description": "<specific issue>", "impact": "<expected impact>" }
    ]
  },
  "projectedImpact": {
    "estimatedRankingImprovement": "<e.g. +20-40 positions for target keywords>",
    "timeline": "<e.g. 4-8 weeks>"
  }
}`;

export async function runSeoAudit(shop, storeData) {
  const policies = storeData.store_context?.native_policies || {};
  const customPages = storeData.store_context?.custom_pages || {};
  console.log('[SEO Audit] Starting for', shop);
  console.log('[SEO Audit] Products:', (storeData.catalog || []).length, '| Collections:', (storeData.collections || []).length, '| Blog articles:', (storeData.blog_content || []).length);

  const trimmed = {
    store: storeData.store_context || {},
    policies: policies,
    custom_pages: customPages,
    collections: (storeData.collections || []).map(c => ({
      title: c.title, handle: c.handle, description: (c.description || '').slice(0, 400),
      products_count: c.products_count, has_image: !!c.image,
    })),
    products: (storeData.catalog || []).slice(0, 25).map(p => ({
      title: p.title, handle: p.handle, status: p.status,
      description: (p.description || '').slice(0, 500),
      vendor: p.vendor, product_type: p.product_type,
      tags: p.tags, total_inventory: p.total_inventory,
      variants: (p.variants || []).slice(0, 3).map(v => ({ title: v.title, price: v.price, sku: v.sku })),
      images: (p.images || []).slice(0, 5).map(img => ({ hasAltText: !!(img.altText && img.altText.length > 0), altText: (img.altText || '').slice(0, 100) })),
      images_count: (p.images || []).length,
    })),
    blog_articles: (storeData.blog_content || []).slice(0, 10).map(b => ({
      blog: b.blog, title: b.title, handle: b.handle, tags: b.tags,
      body_length: (b.body || '').length,
      body_preview: (b.body || '').slice(0, 200),
    })),
    redirects: (storeData.redirects || []).slice(0, 20),
    redirects_count: (storeData.redirects || []).length,
  };

  const storePayload = JSON.stringify(trimmed);
  const estimatedTokens = Math.ceil(storePayload.length / 4);
  console.log('[SEO Audit] Payload:', storePayload.length, 'chars (~' + estimatedTokens + ' tokens)');

  const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_FALLBACK,
  ].filter(Boolean);

  if (API_KEYS.length === 0) throw new Error('No GEMINI_API_KEY configured');

  const SEO_MODELS = [
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
  ];

  let audit = null;
  let lastError = null;

  for (const apiKey of API_KEYS) {
    if (audit) break;
    const keyLabel = apiKey === API_KEYS[0] ? 'primary' : 'fallback';
    for (const model of SEO_MODELS) {
      try {
        console.log('[SEO Audit] Trying', model, '(' + keyLabel + ' key)');
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const payload = JSON.stringify({
          system_instruction: { parts: [{ text: seoAuditSystemPrompt }] },
          contents: [
            { role: 'user', parts: [{ text: "Store Data:\n" + JSON.stringify(trimmed) }] },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 32768,
            responseMimeType: "application/json"
          },
        });

        const geminiRes = await httpsRequest(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, payload);

        const data = geminiRes.json();

        if (!geminiRes.ok) {
          const errMsg = data?.error?.message || JSON.stringify(data);
          const status = data?.error?.status || geminiRes.status;
          if (status === 429 || status === 503 || status === 404 ||
            errMsg.includes('high demand') || errMsg.includes('rate limit') ||
            errMsg.includes('Resource exhausted') || errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('overloaded') || errMsg.includes('not found') ||
            errMsg.includes('not supported') || errMsg.includes('does not exist')) {
            console.warn('[SEO Audit]', model, 'unavailable:', errMsg.slice(0, 120));
            lastError = errMsg;
            continue;
          }
          throw new Error('Gemini API error: ' + errMsg);
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!rawText) {
          console.warn('[SEO Audit]', model, 'returned empty response');
          lastError = 'Empty response';
          continue;
        }

        try {
          const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          audit = JSON.parse(cleanText);
          console.log('[SEO Audit] Complete with', model, '- score:', audit?.executiveSummary?.seoHealthScore, 'grade:', audit?.executiveSummary?.grade);
          break;
        } catch (parseErr) {
          console.error('[SEO Audit] Failed to parse response:', rawText.slice(0, 500));
          lastError = 'Malformed response';
          continue;
        }
      } catch (err) {
        if (err.message?.includes('timed out') || err.message?.includes('ECONNRESET')) {
          console.warn('[SEO Audit]', model, 'timed out');
          lastError = err.message;
          continue;
        }
        throw err;
      }
    }
  }

  if (!audit) {
    throw new Error('All models and API keys failed. Last error: ' + lastError);
  }

  return audit;
}

// ──────────────────────────────────────────────────────────────────────
// 9. SHOPIFY GUIDE — Step-by-Step Generation
// ──────────────────────────────────────────────────────────────────────

export async function generateGuideSteps(question) {
  const systemInstruction = `You are an expert Shopify admin assistant. A store owner is asking how to do something in the Shopify admin panel.

Provide a clear, step-by-step guide to accomplish their goal.

REQUIREMENTS:
- Provide numbered, actionable steps (3-10 steps)
- Each step must describe exactly what to click or where to navigate
- Use the exact labels/names visible in the Shopify admin UI
- Be specific about menu locations, button names, and page sections

Return ONLY valid JSON:
{
  "title": "Short title for the task",
  "summary": "One sentence explaining what this accomplishes",
  "steps": [
    { "number": 1, "instruction": "What to do", "detail": "Extra context" }
  ],
  "totalSteps": <number>
}`;

  console.log(`🧭 Generating guide steps for: "${question.slice(0, 80)}"`);
  const result = await callGemini(systemInstruction, `Shopify task: ${question}`, 0.3);
  if (!result.steps || !Array.isArray(result.steps)) throw new Error('Invalid guide data');
  return result;
}

// ──────────────────────────────────────────────────────────────────────
// 10. SHOPIFY GUIDE — Screenshot Analysis for Visual Navigation
// ──────────────────────────────────────────────────────────────────────

export async function analyzeScreenshotForGuide(question, screenshotBase64, stepsCompleted, currentStepInstruction) {
  const systemInstruction = `You are a visual UI navigation assistant for the Shopify admin panel.

You receive a screenshot + the user's task + the current step instruction.
Identify the EXACT UI element the user should click/interact with next.

IMPORTANT: You MUST provide the element's visible text label exactly as shown on screen.
Also provide bounding box as PERCENTAGES of the screenshot dimensions:
- xPercent: distance from left edge (0=left, 100=right)
- yPercent: distance from top edge (0=top, 100=bottom)  
- widthPercent / heightPercent: size as % of screenshot

Return ONLY valid JSON:
{
  "found": true,
  "elementText": "Exact visible text on the button/link/menu item",
  "elementType": "button|link|menuItem|tab|input|checkbox|icon",
  "elementDescription": "Description of the element",
  "instruction": "What user should do",
  "boundingBox": { "xPercent": 0, "yPercent": 0, "widthPercent": 0, "heightPercent": 0 },
  "isComplete": false,
  "needsScroll": false,
  "scrollDirection": "down"
}

Rules:
- elementText must be the EXACT text visible on the element (e.g. "Discounts", "Create discount", "Save")
- For icon-only buttons with no text, set elementText to "" and describe in elementDescription
- If the element is not visible on screen, set found=false and needsScroll=true
- If the entire task is already completed, set isComplete=true`;

  const mimeType = screenshotBase64.includes('data:') ?
    (screenshotBase64.match(/data:(.*?);base64/)?.[1] || 'image/png') : 'image/png';
  const imgData = screenshotBase64.includes(',') ? screenshotBase64.split(',')[1] : screenshotBase64;

  console.log(`🔍 Analyzing screenshot with gemini-3-flash-preview`);

  const API_KEYS = getApiKeys();
  let lastError = null;

  for (const apiKey of API_KEYS) {
    const keyLabel = apiKey === API_KEYS[0] ? 'primary' : 'fallback';
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      const payload = JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [
          { text: `Task: ${question}\nCurrent step: ${currentStepInstruction}\nSteps already done: ${JSON.stringify(stepsCompleted || [])}` },
          { inline_data: { data: imgData, mime_type: mimeType } }
        ]}],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
      });
      const res = await httpsRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, payload);
      const resData = res.json();
      if (!res.ok) { lastError = new Error(resData?.error?.message || `HTTP ${res.status}`); continue; }
      const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) { lastError = new Error('Empty response'); continue; }
      const parsed = extractJSON(rawText);
      if (!parsed) { console.error('⚠️ Raw:', rawText.slice(0, 300)); lastError = new Error('Bad JSON'); continue; }
      console.log(`✅ Screenshot analysis done (gemini-3-flash, ${keyLabel})`);
      return parsed;
    } catch (err) { lastError = err; console.error(`❌ gemini-3-flash (${keyLabel}):`, err.message); }
  }
  throw lastError || new Error('Screenshot analysis failed');
}
 