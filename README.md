# OpenThorn

**AI-powered website builder. Describe what you want â€” get a complete, deployable website.**

OpenThorn is a bring-your-own-key (BYOK) platform that generates full, production-ready websites from natural language prompts. Users connect their own LLM provider API keys, so there are no subscriptions and no lock-in.

---

## Features

- **Natural-language generation** â€” describe a website in plain language; the agent writes, bundles, and previews it in-browser
- **Multi-provider AI** â€” connect OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, Together AI, xAI, Cohere, Perplexity, OpenRouter, Ollama, Fireworks, Cerebras, Azure OpenAI, Amazon Bedrock, or Nvidia NIM
- **Live preview** â€” instant in-browser preview powered by esbuild-wasm (no server round-trip)
- **One-click deploy** â€” publish directly to Netlify via the integrated deployment API
- **Real-time collaboration** â€” multiplayer editing with presence indicators (Supabase Realtime)
- **Encrypted key storage** â€” API keys are encrypted at rest with AES-256-GCM and never exposed to the client
- **Templates & community** â€” start from curated templates or browse community-published projects

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, React Router v7, Vite 6 |
| Styling | CSS Modules, Framer Motion |
| Auth & Database | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| AI agent | Custom agent runtime (`src/lib/agent.ts`) |
| In-browser bundler | esbuild-wasm |
| Serverless API | Vercel Functions |
| User site hosting | Netlify |
| Rate limiting | Upstash Redis (optional) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Netlify](https://app.netlify.com/user/applications) personal access token
- At least one LLM provider API key (added in-app after sign-up)

### Installation

```bash
git clone https://github.com/BuildingTechAlternatives/OpenThorn.git
cd OpenThorn
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (browser) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key (browser) |
| `SUPABASE_URL` | Yes | Supabase project URL (server) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key (server) |
| `NETLIFY_TOKEN` | Yes | Netlify personal access token |
| `KEY_ENCRYPTION_SECRET` | Yes | 48-byte secret for API key encryption â€” generate with `openssl rand -base64 48` |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for production rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |

### Database Setup

Apply the Supabase migrations:

```bash
supabase db push
```

Or apply the SQL files in `supabase/migrations/` manually through the Supabase dashboard, in order.

### Development

```bash
npm run dev
```

Starts Vite on `http://localhost:5173` with local API shims for the serverless functions.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit tests |

---

## Project Structure

```
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ components/        # Reusable UI components
â”‚   â”œâ”€â”€ pages/             # Route-level pages (code-split)
â”‚   â”œâ”€â”€ lib/               # Core utilities
â”‚   â”‚   â”œâ”€â”€ agent.ts       # AI agent orchestration
â”‚   â”‚   â”œâ”€â”€ crypto.ts      # AES-256-GCM key encryption
â”‚   â”‚   â”œâ”€â”€ deploy.ts      # Netlify deployment client
â”‚   â”‚   â””â”€â”€ preview-bundle.ts  # In-browser esbuild bundler
â”‚   â””â”€â”€ data/              # Static content (blog posts)
â”œâ”€â”€ api/
â”‚   â”œâ”€â”€ _shared.ts         # JWT verification, rate limiting, encryption
â”‚   â”œâ”€â”€ deploy-netlify.ts  # Netlify deployment endpoint
â”‚   â””â”€â”€ provider-keys.ts   # API key storage endpoint
â”œâ”€â”€ supabase/
â”‚   â””â”€â”€ migrations/        # Database schema migrations
â”œâ”€â”€ public/                # Static assets and provider logos
â”œâ”€â”€ docs/                  # Security documentation
â”œâ”€â”€ vercel.json            # Vercel deployment config (SPA routing + security headers)
â””â”€â”€ .env.example           # Environment variable template
```

---

## Deployment

The project deploys on **Vercel** with the configuration in `vercel.json`.

### Deploy to Vercel

1. Import the repository in the [Vercel dashboard](https://vercel.com/new)
2. Set all required environment variables under **Project â†’ Settings â†’ Environment Variables**
3. Deploy â€” Vercel will run `npm run build` automatically

### Security Headers

`vercel.json` configures production security headers on every response:

- `Strict-Transport-Security` (HSTS, 1-year max-age)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (strict allowlist â€” self, fonts, esm.sh, blob:, wss:)
- `Permissions-Policy` (camera, microphone, geolocation disabled)

---

## Security

- **Encrypted keys** â€” provider API keys are encrypted with AES-256-GCM before storage; the raw key never leaves the server
- **Row-level security** â€” all Supabase tables are protected by PostgreSQL RLS policies
- **Server-side JWT verification** â€” every API call validates the Supabase JWT before processing
- **Rate limiting** â€” per-user, per-endpoint limits (in-memory in development; Upstash Redis in production)
- **No source maps** â€” production builds omit source maps

See `docs/security-csp.md` for Content Security Policy details.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

---

## License

This project is proprietary. All rights reserved.
