// Quick post-build sanity check for the prerender output. Run after npm run build.
import { readFileSync } from 'fs'

const checks = [
  ['dist/index.html', '"@type":"Organization"', 'home: Organization JSON-LD', (h) => h.replace(/\s+/g, '')],
  ['dist/index.html', '"@type":"WebSite"', 'home: WebSite JSON-LD', (h) => h.replace(/\s+/g, '')],
  ['dist/index.html', 'SoftwareApplication', 'home: SoftwareApplication JSON-LD'],
  ['dist/index.html', 'Build with OpenThorn', 'home: hero SSR body'],
  ['dist/index.html', 'deploy anywhere', 'home: hero subtitle SSR body'],
  ['dist/index.html', 'rel="canonical" href="https://www.openthorn.app/"', 'home: canonical'],
  ['dist/index.html', 'og-card.png', 'home: og-card image'],
  ['dist/faq/index.html', 'FAQPage', 'faq: FAQPage JSON-LD'],
  ['dist/faq/index.html', 'data-prerendered', 'faq: JSON-LD marked for boot removal'],
  ['dist/faq/index.html', '17 AI providers', 'faq: provider answer'],
  ['dist/pricing/index.html', '<div id="root"><', 'pricing: non-empty root'],
  ['dist/changelog/index.html', '<div id="root"><', 'changelog: non-empty root'],
  ['dist/faq/index.html', 'aria-expanded', 'faq: interactive markup SSR body'],
  ['dist/blog/what-is-a-byok-ai-website-builder/index.html', 'BlogPosting', 'byok post: BlogPosting'],
  ['dist/blog/what-is-a-byok-ai-website-builder/index.html', 'BreadcrumbList', 'byok post: BreadcrumbList'],
  ['dist/blog/what-is-a-byok-ai-website-builder/index.html', 'What does BYOK mean?', 'byok post: SSR body'],
  ['dist/blog/introducing-openthorn/index.html', 'The problem with AI builders', 'intro post: SSR body'],
  ['dist/sitemap.xml', 'what-is-a-byok-ai-website-builder', 'sitemap: new post'],
  ['dist/llms.txt', 'BYOK', 'llms.txt copied to dist'],
  ['dist/robots.txt', 'GPTBot', 'robots.txt: AI crawlers'],
  ['dist/og-card.png', null, 'og-card.png copied to dist'],
]

let failed = 0
for (const [file, needle, label, transform] of checks) {
  try {
    let content = readFileSync(file, needle === null ? undefined : 'utf8')
    if (needle !== null && transform) content = transform(content)
    const ok = needle === null || content.includes(needle)
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
    if (!ok) failed++
  } catch (e) {
    console.log(`FAIL ${label} (${e.message})`)
    failed++
  }
}
process.exit(failed ? 1 : 0)
