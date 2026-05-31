import { Routes, Route } from 'react-router-dom'
import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import MeetBloomSection from './components/MeetBloomSection/MeetBloomSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import PricingPage from './pages/PricingPage'
import styles from './App.module.css'

function HomePage() {
  return (
    <>
      <HeroSection />
      <MeetBloomSection />
      <BYOKSection />
      <BottomCTA />
    </>
  )
}

export default function App() {
  return (
    <div className={styles.app}>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
