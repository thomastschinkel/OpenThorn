export interface ProjectFile {
  name: string
  path: string
  language: string
  content: string
}

export const sampleFiles: ProjectFile[] = [
  {
    name: 'index.html',
    path: 'index.html',
    language: 'html',
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Flowly — AI Project Management</title>
    <link rel="stylesheet" href="/styles/main.css" />
  </head>
  <body>
    <nav class="navbar">
      <div class="nav-brand">
        <span class="logo-dot"></span>
        Flowly
      </div>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#docs">Docs</a>
        <a href="#start" class="cta-btn">Get Started</a>
      </div>
    </nav>

    <main>
      <section class="hero">
        <h1>Project management,<br/><span class="gradient-text">powered by AI</span></h1>
        <p class="hero-sub">
          Flowly helps teams ship faster with intelligent task prioritization,
          automated workflows, and real-time collaboration.
        </p>
        <div class="hero-buttons">
          <button class="btn-primary">Start free trial</button>
          <button class="btn-secondary">Watch demo →</button>
        </div>
      </section>

      <section id="features" class="features-section">
        <h2 class="section-label">KEY FEATURES</h2>
        <div class="features-grid" id="feature-cards"></div>
      </section>
    </main>

    <footer class="footer">
      <span>© 2026 Flowly</span>
      <span>Privacy · Terms · Contact</span>
    </footer>

    <script src="/scripts/main.js"></script>
  </body>
</html>`,
  },
  {
    name: 'main.css',
    path: 'styles/main.css',
    language: 'css',
    content: `/* ── Reset ─────────────────────────── */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Manrope', system-ui, sans-serif;
  background: #080811;
  color: #e4e4e7;
  -webkit-font-smoothing: antialiased;
}

/* ── Navbar ───────────────────────── */
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  background: rgba(8, 8, 17, 0.8);
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
}

.logo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 13px;
  color: #888;
}

.nav-links a {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: #fff;
}

.cta-btn {
  background: linear-gradient(135deg, #6366f1, #5558e6);
  color: #fff !important;
  padding: 7px 18px;
  border-radius: 8px;
  font-weight: 600;
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.25);
}

/* ── Hero ─────────────────────────── */
.hero {
  text-align: center;
  padding: 80px 24px 60px;
  position: relative;
}

.hero h1 {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.12;
  margin-bottom: 18px;
  color: #fff;
  letter-spacing: -0.02em;
}

.gradient-text {
  background: linear-gradient(135deg, #818cf8, #c084fc, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-sub {
  font-size: 16px;
  color: #6b6b7b;
  max-width: 520px;
  margin: 0 auto 32px;
  line-height: 1.7;
}

.hero-buttons {
  display: flex;
  gap: 14px;
  justify-content: center;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #5558e6);
  color: #fff;
  padding: 12px 28px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
}

.btn-secondary {
  background: transparent;
  color: #aaa;
  padding: 12px 28px;
  border-radius: 12px;
  font-size: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
}

/* ── Features ─────────────────────── */
.features-section {
  padding: 40px 28px 60px;
  max-width: 700px;
  margin: 0 auto;
}

.section-label {
  text-align: center;
  font-size: 13px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 24px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* ── Footer ───────────────────────── */
.footer {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 24px 28px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #5a5a6a;
}`,
  },
  {
    name: 'main.js',
    path: 'scripts/main.js',
    language: 'javascript',
    content: `// Feature cards data
const features = [
  { icon: '✦', label: 'AI Planning', desc: 'Smart task prioritization' },
  { icon: '✦', label: 'Real-time Sync', desc: 'Instant team updates' },
  { icon: '✦', label: 'Custom Views', desc: 'Flexible workflows' },
  { icon: '✦', label: 'Analytics', desc: 'Deep insights' },
  { icon: '✦', label: 'Integrations', desc: 'Connect your stack' },
  { icon: '✦', label: 'Security', desc: 'Enterprise-grade' },
];

// Render feature cards
function renderFeatures() {
  const grid = document.getElementById('feature-cards');
  if (!grid) return;

  grid.innerHTML = features
    .map(
      (f) => \`
        <div class="feature-card">
          <div class="feature-icon">\${f.icon}</div>
          <span class="feature-label">\${f.label}</span>
          <span class="feature-desc">\${f.desc}</span>
        </div>
      \`
    )
    .join('');
}

// Smooth scroll for anchor links
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// CTA button analytics
function initCTAButtons() {
  document.querySelectorAll('.btn-primary, .cta-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      console.log('CTA clicked:', btn.textContent.trim());
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderFeatures();
  initSmoothScroll();
  initCTAButtons();
});`,
  },
  {
    name: 'package.json',
    path: 'package.json',
    language: 'json',
    content: `{
  "name": "flowly-landing",
  "version": "1.0.0",
  "description": "Flowly AI-powered project management landing page",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}`,
  },
]
