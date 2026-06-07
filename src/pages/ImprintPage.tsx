import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function ImprintPage() {
  usePageTitle('Imprint')
  return (
    <LegalPage title="Imprint" lastUpdated="June 6, 2026">
      <h2>Operator</h2>
      <p>
        <strong>Thomas Tschinkel</strong><br />
        Rome, Italy
      </p>

      <h2>Contact</h2>
      <p>
        Name: Thomas Tschinkel<br />
        Email: <a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a>
      </p>
    </LegalPage>
  )
}
