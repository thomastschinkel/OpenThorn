import { Link } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import { useJsonLd } from '../lib/useJsonLd'
import glossary from '../data/glossary.json'
import styles from './GlossaryPage.module.css'

const SITE_URL = 'https://www.openthorn.app'

export default function GlossaryPage() {
  usePageTitle('AI Website Builder Glossary', {
    description:
      'Plain-English definitions of the terms behind AI website building: BYOK, AI agents, tokens, context windows, API keys, and more.',
  })

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'AI Website Builder Glossary',
    url: `${SITE_URL}/glossary`,
    hasDefinedTerm: glossary.map((g) => ({
      '@type': 'DefinedTerm',
      name: g.term,
      description: g.definition,
      url: `${SITE_URL}/glossary#${g.id}`,
    })),
  })

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <p className={styles.eyebrow}>Glossary</p>
        <h1 className={styles.title}>AI website building, defined</h1>
        <p className={styles.subtitle}>
          Short, plain-English definitions of the terms you will meet when building websites with
          AI — no jargon required to get started.
        </p>

        {glossary.map((g) => (
          <section key={g.id} id={g.id} className={styles.entry}>
            <h2>{g.term}</h2>
            <p>{g.definition}</p>
          </section>
        ))}

        <p className={styles.links}>
          Go deeper:{' '}
          <Link to="/blog/what-is-a-byok-ai-website-builder">what is a BYOK AI website builder?</Link>{' '}
          · <Link to="/blog/how-to-get-an-ai-api-key">how to get an API key</Link> ·{' '}
          <Link to="/faq">FAQ</Link>
        </p>
      </div>
    </div>
  )
}
