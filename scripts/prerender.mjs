// Post-build script: generates pre-rendered HTML for every public route.
// Run: node scripts/prerender.mjs
//
// Produces: dist/{route}/index.html with correct <head> metadata for each route.
// Social media crawlers (Twitter, LinkedIn, Slack) don't execute JS — they need
// these tags in the static HTML. Vercel serves static files before rewrite rules,
// so pre-rendered files are served automatically without any config changes.
//
// When adding a new blog post, add a matching entry to the routes array below.

import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const SITE_URL = 'https://www.openthorn.app'
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`

const routes = [
  {
    path: '/',
    title: 'OpenThorn — The BYOK AI Website Builder',
    description:
      'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'OpenThorn',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      description:
        'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.',
      url: SITE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free to use — bring your own API keys',
      },
    },
  },
  {
    path: '/pricing',
    title: 'Model Pricing — OpenThorn',
    description:
      'Compare per-token pricing across the AI providers OpenThorn supports. You pay your provider directly — OpenThorn charges no subscription.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/blog',
    title: 'Blog — OpenThorn',
    description:
      'Product updates, guides, and stories from the OpenThorn team on building and shipping websites with AI.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/blog/introducing-openthorn',
    title: 'Introducing OpenThorn — Build Full-Stack Apps from a Single Prompt — OpenThorn',
    description:
      'Most web apps still take weeks to build. We built OpenThorn to close that gap — describe your app in plain language and ship the same day.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Introducing OpenThorn — Build Full-Stack Apps from a Single Prompt',
      description:
        'Most web apps still take weeks to build. We built OpenThorn to close that gap — describe your app in plain language and ship the same day.',
      datePublished: '2026-06-06',
      url: `${SITE_URL}/blog/introducing-openthorn`,
      author: { '@type': 'Organization', name: 'OpenThorn' },
      publisher: {
        '@type': 'Organization',
        name: 'OpenThorn',
        logo: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE },
      },
      image: DEFAULT_OG_IMAGE,
    },
  },
  {
    path: '/faq',
    title: 'FAQ — OpenThorn',
    description:
      'Answers to common questions about OpenThorn — how bring-your-own-key works, supported AI providers, costs, and deploying your generated site.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/terms',
    title: 'Terms of Service — OpenThorn',
    description: 'Terms of service for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — OpenThorn',
    description: 'Privacy policy for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/cookies',
    title: 'Cookie Policy — OpenThorn',
    description: 'Cookie policy for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/imprint',
    title: 'Imprint — OpenThorn',
    description: 'Legal imprint for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/moderation',
    title: 'Moderation and DSA — OpenThorn',
    description: 'Moderation policy and DSA compliance information for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
]

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function injectMeta(html, route) {
  let out = html

  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(route.title)}</title>`)

  out = out.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`
  )

  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeAttr(route.title)}$2`)
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`)
  out = out.replace(/(<meta property="og:url" content=")[^"]*(")/,
    `$1${SITE_URL}${route.path}$2`)
  out = out.replace(/(<meta property="og:image" content=")[^"]*(")/,
    `$1${route.ogImage}$2`)
  out = out.replace(/(<meta property="og:type" content=")[^"]*(")/,
    `$1${route.ogType}$2`)

  out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/,
    `$1${escapeAttr(route.title)}$2`)
  out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`)
  out = out.replace(/(<meta name="twitter:image" content=")[^"]*(")/,
    `$1${route.ogImage}$2`)

  if (route.jsonLd) {
    const scriptTag = `<script type="application/ld+json">${JSON.stringify(route.jsonLd)}</script>`
    out = out.replace('</head>', `  ${scriptTag}\n  </head>`)
  }

  return out
}

const baseHtml = readFileSync(join(distDir, 'index.html'), 'utf8')

for (const route of routes) {
  const html = injectMeta(baseHtml, route)

  let outPath
  if (route.path === '/') {
    outPath = join(distDir, 'index.html')
  } else {
    const dir = join(distDir, route.path.slice(1))
    mkdirSync(dir, { recursive: true })
    outPath = join(dir, 'index.html')
  }

  writeFileSync(outPath, html, 'utf8')
  console.log(`✓ ${route.path}`)
}

console.log(`\nPre-rendered ${routes.length} routes.`)
