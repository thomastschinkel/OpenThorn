// Submits all public URLs (from the live sitemap) to IndexNow so Bing and the
// answer engines that consume IndexNow re-crawl promptly after a deploy.
// Run manually after deploying: npm run indexnow
const SITE_URL = 'https://www.openthorn.app'
const KEY = '7f3a9c2e5b8d4f6a1c0e9b7d3a5f8c2e'

const sitemap = await (await fetch(`${SITE_URL}/sitemap.xml`)).text()
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

if (urls.length === 0) {
  console.error('No URLs found in sitemap — aborting')
  process.exit(1)
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: 'www.openthorn.app',
    key: KEY,
    keyLocation: `${SITE_URL}/${KEY}.txt`,
    urlList: urls,
  }),
})

console.log(`Submitted ${urls.length} URLs to IndexNow — HTTP ${res.status}`)
process.exit(res.ok ? 0 : 1)
