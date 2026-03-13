# 🌟 Prism — AI-Powered Shopify Automation Platform

<div align="center">

**🏆 Built for the Bangalore AI Hackathon 2026**

*Empowering Shopify merchants with Generative AI, predictive intelligence, and real-time visual guidance.*

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Polaris](https://img.shields.io/badge/Shopify%20Polaris-13.x-96BF48?logo=shopify&logoColor=white)](https://polaris.shopify.com)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-Pro%20%26%20Vision-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

</div>

## 📌 Project Overview

**Prism** is a full-stack, enterprise-grade Shopify application that acts as an AI co-pilot for e-commerce merchants. It combines a React/Polaris merchant dashboard, a Node.js/Express backend, a Python-based ML engine, and a Manifest V3 Chrome Extension into a cohesive, production-ready platform.

The platform eliminates hours of manual store management by automating product creation, content generation, order processing, store auditing, and interactive navigation guidance — all powered by Google Gemini Pro & Vision APIs.

---

## 🚀 Platform Features Matrix

| # | Dashboard Level | Core Capability | AI / Tech Used | Key Actions |
|---|---|---|---|---|
| 1 | **Core Automation** | Rapid Store Setup | Gemini Vision, Gemini Pro | Add Product from image, Write Blog, Generate Policies, Manage Orders |
| 2 | **Visual Guide** | Interactive Navigation | Gemini Pro, Chrome Extension | NL chat → DOM highlighting in live Shopify Admin |
| 3 | **GEO Audit** | Generative Engine Optimization | Gemini Pro (250k token budget) | Multi-layer SEO audit, Health Score, Priority Action Plan |
| 4 | **Product Intelligence** | Predictive ML Analytics | Python (scikit-learn, K-Means) | Cluster Scatter Chart, Metric Simulators, Performance Projections |

---

## 🏗️ System Architecture

Prism is a decoupled, three-tier system where every layer has a clear, bounded responsibility:

```
                    ┌──────────────────────────────────┐
                    │       Shopify Admin (Browser)    │
                    │  ┌──────────────────────────┐    │
                    │  │  Prism Dashboard (iframe)│    │
                    │  │  React + Polaris + Vite  │    │
                    │  └────────────┬─────────────┘    │
                    │               │ postMessage      │
                    │  ┌────────────▼─────────────┐    │
                    │  │  Chrome Extension        │    │ 
                    │  │  (content-script.js)     │    │
                    │  └──────────────────────────┘    │
                    └──────────────┬───────────────────┘
                                   │ HTTPS (REST API)
                    ┌──────────────▼────────────────────┐
                    │    Node.js + Express (Port 3000)  │
                    │  ┌─────────────┐ ┌────────────┐   │
                    │  │  Auth/OAuth │ │  AI Routes │   │ 
                    │  └─────────────┘ └──────┬─────┘   │
                    │                         │         │
                    │  ┌──────────────────────▼──────┐  │
                    │  │  services/ai/gemini.js      │  │ 
                    │  │  Google Gemini Pro & Vision │  │
                    │  └─────────────────────────────┘  │
                    │  ┌──────────────────────────────┐ │
                    │  │  backend/ml-engine/ (Python) │ │
                    │  │  K-Means, FastAPI, scikit    │ │
                    │  └──────────────────────────────┘ │
                    └───────────────────────────────────┘
```

**Traffic Flow:**
- **ngrok** tunnels `https://<id>.ngrok-free.app` → `localhost:3000` (Express)
- Express proxies non-API routes → `localhost:5173` (Vite dev server)
- Shopify OAuth callbacks hit `localhost:3000/api/auth/callback`

---

## 🛠️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19.x | UI component framework |
| TypeScript | ~6.0 | Type-safe development |
| Vite | 8.x | Build tool & dev server (Port 5173) |
| Shopify Polaris | 13.9.x | Native Shopify design system components |
| TailwindCSS | 4.x | Utility-first layout & custom styling |
| Lucide React | 1.8.x | Consistent icon library |
| react-joyride | 3.x | Interactive onboarding tour |
| @uiw/react-json-view | 2.x | Structured JSON data display |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Server runtime |
| Express | 5.x | HTTP framework & API router |
| http-proxy-middleware | 3.x | Proxy non-API requests to Vite |
| cors | 2.x | Cross-origin request handling |
| dotenv | 17.x | Environment variable management |
| concurrently | 9.x | Run backend + frontend in one command |

### ML Engine

| Technology | Purpose |
|---|---|
| Python 3.x | ML pipeline runtime |
| scikit-learn | K-Means clustering & model training |
| FastAPI / Flask | Exposes ML predictions as HTTP endpoints |
| pandas / numpy | Data preprocessing & feature engineering |

### Chrome Extension

| File | Purpose |
|---|---|
| Manifest V3 | Extension configuration & permissions |
| `content-script.js` | Injected into Shopify Admin DOM |
| `service-worker.js` | Background lifecycle management |
| `overlay.css` | Glowing highlight & tooltip styles |

---

## 📂 Complete File Structure

```text
prism/
│
├── backend/                          # Node.js Express API Server
│   ├── routes/                       # Route handlers (mounted at /api/*)
│   │   ├── auth.js                   # OAuth 2.0 install, callback, session routes
│   │   ├── product.js                # AI product generation & Shopify product CRUD
│   │   ├── blog.js                   # AI blog post generation & publishing
│   │   ├── policy.js                 # AI store policy generation
│   │   ├── orders.js                 # Shopify order fetching & fulfillment
│   │   ├── ai-audit.js               # GEO audit orchestration route
│   │   └── guide.js                  # AI navigation guide (Level 2)
│   │
│   ├── services/                     # Business logic & external integrations
│   │   ├── ai/
│   │   │   └── gemini.js             # All Gemini Pro & Vision API calls (44KB)
│   │   └── shopify/                  # Shopify Admin REST API wrappers
│   │
│   ├── ml-engine/                    # Python ML Pipeline (Level 4)
│   │   ├── api.py                    # FastAPI server exposing ML endpoints
│   │   ├── clustering.py             # K-Means cluster assignment logic
│   │   ├── generate_data.py          # Synthetic product data generation
│   │   ├── inference.py              # Real-time product scoring & prediction
│   │   ├── main_pipeline.py          # End-to-end pipeline orchestration
│   │   ├── model_training.py         # Model fit, evaluation & serialization
│   │   ├── preprocessing.py          # Feature engineering & normalization
│   │   ├── simulation.py             # Metric simulation for "what-if" scenarios
│   │   ├── utils.py                  # Shared utility functions
│   │   ├── visualizations.py         # Cluster chart data generation
│   │   ├── outputs/                  # Saved model artifacts & cluster data
│   │   └── requirements.txt          # Python dependencies
│   │
│   ├── server.js                     # Express entry point — Port 3000
│   └── store.js                      # In-memory OAuth token store
│
├── src/                              # React Frontend (Vite)
│   ├── api/                          # Typed fetch clients for backend API calls
│   ├── assets/                       # Static images, icons, global CSS
│   │
│   ├── features/
│   │   ├── auth/                     # Auth state & session management
│   │   ├── extraction/               # Shopify data extraction utilities
│   │   └── dashboard/
│   │       ├── AppShell.tsx          # Top-level layout: nav tabs, routing (9KB)
│   │       ├── DashboardContext.tsx  # Shared dashboard state provider
│   │       ├── DashboardView.tsx     # Dashboard entry point wrapper
│   │       ├── components/
│   │       │   ├── HealthGauge.tsx   # SVG radial health score gauge
│   │       │   └── OnboardingTour.tsx# react-joyride guided tour (14KB)
│   │       ├── hooks/                # Custom hooks (useShopify, useAudit, etc.)
│   │       └── pages/
│   │           ├── ProductUploadPage.tsx    # Level 1: AI product creation (9KB)
│   │           ├── BlogPostPage.tsx         # Level 1: AI blog generation (3.5KB)
│   │           ├── PolicyPage.tsx           # Level 1: AI policy generation (5.4KB)
│   │           ├── OrdersPage.tsx           # Level 1: Order management (11.6KB)
│   │           ├── ShopifyGuidePage.tsx     # Level 2: Visual guide chat (14.2KB)
│   │           ├── GeoAuditPage.tsx         # Level 3: GEO audit dashboard (15.9KB)
│   │           └── ClusterDashboardPage.tsx # Level 4: ML cluster viz (21.6KB)
│   │
│   ├── i18n/
│   │   ├── I18nContext.tsx           # Language context & provider
│   │   └── translations.ts           # EN / HI / KN translation dictionaries (14KB)
│   │
│   ├── App.tsx                       # Root component, auth gating
│   ├── main.tsx                      # Vite React entry point
│   └── index.css                     # Global styles & Tailwind directives
│
├── extension/                        # Chrome Extension (Manifest V3)
│   ├── manifest.json                 # Extension config, permissions, host_permissions
│   ├── content-script.js             # DOM reader & highlight injector (14.8KB)
│   ├── service-worker.js             # Background service worker (3KB)
│   └── overlay.css                   # Pulsing highlight & tooltip animations (4KB)
│
├── public/                           # Static public assets served by Vite
├── .env.local                        # Local environment variables (DO NOT COMMIT)
├── .gitignore                        # Git ignore rules
├── index.html                        # Vite HTML entry point
├── package.json                      # NPM scripts & dependencies
├── vite.config.ts                    # Vite bundler configuration
├── tsconfig.json                     # TypeScript root config
├── tsconfig.app.json                 # App-specific TS config
└── tsconfig.node.json                # Node-specific TS config
```

---

## 🎨 Deep Dive: Shopify Polaris

Prism uses **[Shopify Polaris v13](https://polaris.shopify.com/)** as its primary UI system. This is a deliberate architectural decision, not just a styling choice.

### Why Polaris?

| Benefit | Details |
|---|---|
| **Merchant Trust** | Polaris components look identical to native Shopify UI, reducing friction and increasing adoption. |
| **Accessibility** | Full ARIA compliance, keyboard navigation, and screen-reader support built-in. |
| **Responsiveness** | Works seamlessly on Shopify Desktop Admin and the Shopify Mobile App. |
| **Consistency** | Tokens, spacing, and color systems ensure visual coherence across all four dashboard levels. |

### Key Polaris Components in Use

| Component | Used In | Purpose |
|---|---|---|
| `<Page>` | All pages | Standard page layout with title & action slots |
| `<Card>` / `<Box>` | All levels | Content container with Shopify-native styling |
| `<ResourceList>` | Orders Page | Renders the unfulfilled orders list |
| `<IndexTable>` | Product & Blog | Tabular data display |
| `<Banner>` | Error & Success | User-facing status notifications |
| `<Spinner>` | All async actions | Loading indicators |
| `<Select>` | i18n Selector | Language dropdown |
| `<TextField>` | Forms | Polaris-styled text inputs |
| `<Button>` | All pages | Primary, secondary, and destructive actions |
| `<Badge>` | Order status | Visual status indicators |

---

## 🤖 Deep Dive: ML Engine (Level 4)

The Level 4 Product Intelligence dashboard is backed by a real, trained machine learning pipeline written entirely in Python, living in `backend/ml-engine/`.

### Pipeline Overview

```
Raw Product Data (Shopify API)
        │
        ▼
preprocessing.py       ← Feature engineering: title length, review count,
                           rating, image count → normalized feature vectors
        │
        ▼
model_training.py      ← Trains K-Means clustering model, serializes
                           model artifacts to outputs/
        │
        ▼
clustering.py          ← Assigns each product to a cluster:
                           "High Performer", "Trust Issue",
                           "Low Engagement", "Underpriced"
        │
        ▼
simulation.py          ← "What-if" engine: adjusts feature values
                           and re-predicts cluster assignments
        │
        ▼
api.py                 ← FastAPI server exposes /predict and
                           /simulate endpoints to the Node.js backend
```

### Cluster Categories

| Cluster | Meaning | Recommended Action |
|---|---|---|
| **High Performer** | High visibility & high buyer confidence | Scale ad spend, use as store hero product |
| **Trust Issue** | High visibility but low buyer confidence | Add reviews, improve imagery, fix description |
| **Low Engagement** | Low visibility despite good product quality | Improve SEO, title, and promotion strategy |
| **Underpriced** | Good metrics but low revenue contribution | Adjust pricing strategy |

---

## 🧩 Deep Dive: Visual Guidance Chrome Extension

### The Core Problem

Shopify Apps are embedded inside a sandboxed `<iframe>`. Due to browser Same-Origin Policy (SOP) and Content Security Policy (CSP), JavaScript running inside the iframe **cannot** read or manipulate the DOM of the outer Shopify Admin page. A standard app simply cannot point a user to a button.

### Prism's Solution: The postMessage Bridge

```
   Prism Dashboard (iframe on app.myshopify.com)
         │
         │  window.parent.postMessage({
         │    type: "PRISM_GUIDE_STEP",
         │    selector: "[data-testid='btn-add-product']",
         │    message: "Click this button to add a product"
         │  }, "https://admin.shopify.com")
         │
         ▼
   Chrome Extension content-script.js
   (Running on admin.shopify.com — full DOM access)
         │
         │  document.querySelector(selector)
         │  → inject overlay.css classes
         │  → display tooltip with instruction text
         │  → add pulsing glow border animation
         │
         ▼
   Merchant sees a highlighted, pulsing button in Shopify Admin
```

### Extension Permissions (`manifest.json`)

| Permission | Reason |
|---|---|
| `"tabs"` | Required to identify the active Shopify Admin tab |
| `host_permissions: <all_urls>` | Required to receive postMessages from the app iframe |
| `content_scripts` on `*.myshopify.com/admin/*` | Injected on all Shopify Admin pages |
| `content_scripts` on `admin.shopify.com/*` | Injected on the new unified Shopify Admin |
| `run_at: document_idle` | Ensures DOM is fully loaded before script runs |

---

## 🛠️ Creating the Shopify App & Permissions

### Step 1 — Create the App

1. Log in to your [Shopify Partner Dashboard](https://partners.shopify.com/).
2. Go to **Apps** → **All apps** → **Create app**.
3. Select **Create app manually**.
4. Name the app **Prism** and confirm.

### Step 2 — Configure API Scopes

In your App Settings → **Configuration** → **Admin API integration**, request the following access scopes:

| Scope | Required For |
|---|---|
| `read_products` | Fetching product catalog for GEO audit & clustering |
| `write_products` | Creating AI-generated products in the store |
| `read_content` | Reading existing blog posts and pages |
| `write_content` | Publishing AI-generated blog posts and policies |
| `read_orders` | Fetching unfulfilled orders for order management |
| `write_orders` | Processing and fulfilling orders |
| `read_themes` | Reading store theme structure |
| `write_themes` | Writing back theme modifications |

### Step 3 — Get Credentials

Navigate to **Client credentials** and copy:
- **Client ID** → maps to `SHOPIFY_API_KEY`
- **Client secret** → maps to `SHOPIFY_API_SECRET`

### Step 4 — Create a Development Store

1. In the Partner Dashboard, go to **Stores** → **Add store**.
2. Select **Development store**, fill in details, and create it.
3. This is the store you will install Prism on for testing.

---

### Setup Steps

**Step 1 — Start the tunnel on port 3000**
```bash
ngrok http 3000
```

You will see output like:
```
Forwarding  https://abcd1234.ngrok-free.app -> http://localhost:3000
```

Copy the `https://` URL.

**Step 2 — Update Shopify App Configuration**

In your Shopify Partner Dashboard → App → **Configuration**:

| Field | Value |
|---|---|
| **App URL** | `https://abcd1234.ngrok-free.app` |
| **Allowed redirection URL(s)** | `https://abcd1234.ngrok-free.app/api/auth/callback` |

**Step 3 — Update `.env.local`**
```env
SHOPIFY_APP_URL=https://abcd1234.ngrok-free.app
```
---

## ⚙️ Environment Configuration

Create a `.env.local` file in the **root** of the project. This file is gitignored and must never be committed.

```env
# ─── Shopify App Credentials ──────────────────────────
SHOPIFY_API_KEY=your_client_id_from_partner_dashboard
SHOPIFY_API_SECRET=your_client_secret_from_partner_dashboard

# ─── Tunneling (ngrok) ────────────────────────────────
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok-free.app

# ─── Google AI ────────────────────────────────────────
GEMINI_API_KEY=your_google_ai_studio_api_key
```

| Variable | Where to Get It | Required |
|---|---|---|
| `SHOPIFY_API_KEY` | Shopify Partner Dashboard → App → Client credentials | ✅ Yes |
| `SHOPIFY_API_SECRET` | Shopify Partner Dashboard → App → Client credentials | ✅ Yes |
| `SHOPIFY_APP_URL` | Your active ngrok HTTPS forwarding URL | ✅ Yes |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) | ✅ Yes |

---

## 💻 Running the Application

### Prerequisites

| Requirement | Minimum Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.9+ (for ML engine) |
| Google Chrome | Latest stable |
| ngrok | Free account |
| Shopify Partner Account | — |

### Step 1 — Clone & Install

```bash
git clone https://github.com/omkar-prabhu-github/priss.git
cd prism
npm install
```

### Step 2 — Configure Environment

Copy and fill in `.env.local` as described in the [Environment Configuration](#-environment-configuration) section.

### Step 3 — Start ngrok

```bash
ngrok http 3000
```

Update `SHOPIFY_APP_URL` in `.env.local` and the Shopify Partner Dashboard with the new URL.

### Step 4 — Start the Servers

The `npm run start` command uses `concurrently` to launch both the Express backend and Vite frontend simultaneously:

```bash
npm run start
```

Expected terminal output:
```
✅ Backend running at http://localhost:3000
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

Individual commands (if needed separately):
```bash
npm run proxy   # Express backend only (port 3000)
npm run dev     # Vite frontend only (port 5173)
```

### Step 5 — Install the App on Your Dev Store

1. Navigate to: `https://your-ngrok-url.ngrok-free.app/install`
2. Enter your development store's `.myshopify.com` name.
3. Complete the OAuth flow — you will be redirected to your store's App Admin.

### Step 6 — Install the Chrome Extension

1. Open **Google Chrome** → navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `prism/extension/` directory from the cloned repository.
5. The **Prism — Shopify Guide** extension will appear in your extensions list.

> The extension automatically activates on any `*.myshopify.com/admin/*` or `admin.shopify.com/*` tab.

---

## 🌍 Internationalization (i18n)

Prism is built for global merchant adoption with zero-reload language switching.

### Supported Languages

| Language | Code | Coverage |
|---|---|---|
| English | `en` | 100% — Default language |
| Hindi | `hi` | 100% — Full translation |
| Kannada | `kn` | 100% — Full translation |

### Architecture

- **`I18nContext.tsx`** — React Context provider wrapping the entire app, exposing a `t(key)` translation function and `setLanguage()` switcher.
- **`translations.ts`** — A single, typed dictionary object with `en`, `hi`, and `kn` keys for every UI string (14KB, fully comprehensive).
- **`<Select>` Dropdown** — Available on Level 1; changing the language instantly propagates across all four dashboard levels without any page reload.
- **Web Speech API** — Voice hints use the `lang` attribute matched to the active language code, ensuring correct pronunciation for all three dialects.

---

*Engineered with precision for the Bangalore AI Hackathon 2026.*
  