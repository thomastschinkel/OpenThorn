import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import MeetBloomSection from './components/MeetBloomSection/MeetBloomSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      <Header />
      <main>
        <HeroSection />
        <MeetBloomSection />
        <BYOKSection />
        <BottomCTA />
      </main>
      <Footer />
    </div>
  )
}
