import LegalPage from './LegalPage'
import { usePageTitle } from '../lib/usePageTitle'

export default function CookiesPage() {
  usePageTitle('Cookie Policy')
  return (
    <LegalPage title="Cookie Policy" lastUpdated="June 6, 2026">
      <h2>1. What Are Cookies and Local Storage</h2>
      <p>
        Cookies are small text files stored in your browser by a website. Many modern web
        applications also use the browser's <strong>localStorage</strong> API — a similar
        mechanism that stores data locally without an expiry date. This page explains
        exactly what OpenThorn stores and why.
      </p>

      <h2>2. Essential Storage</h2>
      <p>
        The following storage is strictly necessary for the service to function. It cannot
        be disabled without breaking the service.
      </p>
      <ul>
        <li>
          <strong>Supabase authentication session</strong> — stores your login session so
          you remain signed in across page loads. Set by Supabase when you sign in.
          Removed when you sign out or clear your browser data.
        </li>
      </ul>

      <h2>3. What We Do Not Use</h2>
      <ul>
        <li>No analytics or tracking cookies.</li>
        <li>No advertising or retargeting cookies.</li>
        <li>No third-party social media tracking pixels.</li>
        <li>No data shared with or sold to data brokers.</li>
      </ul>

      <h2>4. Contact</h2>
      <p>
        For questions about our use of cookies or local storage, contact us at{' '}
        <strong><a href="mailto:mys.thomas00@gmail.com">mys.thomas00@gmail.com</a></strong>.
      </p>
    </LegalPage>
  )
}
