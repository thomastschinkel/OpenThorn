import { useState, useEffect, useRef, useCallback, startTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './ReelCarousel.module.css'

export interface CarouselSlide {
  image: string
  title: string
  description: string
  tag?: string
}

interface ReelCarouselProps {
  slides?: CarouselSlide[]
  autoPlaySpeed?: number
  pauseOnHover?: boolean
  showArrows?: boolean
  showDots?: boolean
}

const bloomSlides: CarouselSlide[] = [
  {
    image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1200&h=675&fit=crop&q=80',
    tag: 'Step 01',
    title: 'Start with an idea',
    description:
      'Describe the app or website you want to create, or drop in screenshots and docs. Bloom understands your vision instantly.',
  },
  {
    image: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1200&h=675&fit=crop&q=80',
    tag: 'Step 02',
    title: 'Watch it come to life',
    description:
      'See your vision transform into a working prototype in real-time. Every component built by AI, visible as it happens.',
  },
  {
    image: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=675&fit=crop&q=80',
    tag: 'Step 03',
    title: 'Refine and ship',
    description:
      'Iterate with simple feedback and deploy to the world with one click. No DevOps, no friction.',
  },
]

const animPreset = {
  duration: 0.8,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
}

export default function ReelCarousel({
  slides = bloomSlides,
  autoPlaySpeed = 5000,
  pauseOnHover = true,
  showArrows = true,
  showDots = false,
}: ReelCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const total = slides.length

  // Autoplay
  const nextSlide = useCallback(() => {
    startTransition(() => {
      setCurrent((prev) => (prev + 1) % total)
      setProgress(0)
    })
  }, [total])

  const prevSlide = useCallback(() => {
    startTransition(() => {
      setCurrent((prev) => (prev - 1 + total) % total)
      setProgress(0)
    })
  }, [total])

  const jumpTo = useCallback((index: number) => {
    startTransition(() => {
      setCurrent(index)
      setProgress(0)
    })
  }, [])

  // Progress timer
  useEffect(() => {
    if (isPaused) return
    const interval = 16
    const increment = 100 / (autoPlaySpeed / interval)
    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextSlide()
          return 0
        }
        return prev + increment
      })
    }, interval)
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [isPaused, autoPlaySpeed, nextSlide])

  const slide = slides[current]
  if (!slide) return null

  return (
    <div
      className={styles.root}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
    >
      {/* Slide image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          className={styles.slideWrapper}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={animPreset}
        >
          <img
            className={styles.slideImage}
            src={slide.image}
            alt={slide.title}
            loading="lazy"
          />
          <div className={styles.overlay} />
        </motion.div>
      </AnimatePresence>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        {slides.map((_, i) => (
          <button
            key={i}
            className={styles.progressSegment}
            onClick={() => jumpTo(i)}
            aria-label={`Go to slide ${i + 1}`}
          >
            <div
              className={`${styles.progressFill} ${i === current ? styles.progressFillActive : ''}`}
              style={{
                width: i === current ? `${progress}%` : i < current ? '100%' : '0%',
              }}
            />
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.contentOverlay}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            className={styles.contentInner}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ ...animPreset, delay: 0.1 }}
          >
            {slide.tag && <span className={styles.dateText}>{slide.tag}</span>}
            <div className={styles.contentElementGroup}>
              <motion.h3
                className={styles.titleText}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ ...animPreset, delay: 0.2 }}
              >
                {slide.title}
              </motion.h3>
              <motion.p
                className={styles.descText}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ ...animPreset, delay: 0.3 }}
              >
                {slide.description}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Arrow buttons */}
      {showArrows && total > 1 && (
        <>
          <button
            className={`${styles.arrowBtn} ${styles.arrowLeft}`}
            onClick={prevSlide}
            aria-label="Previous slide"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <button
            className={`${styles.arrowBtn} ${styles.arrowRight}`}
            onClick={nextSlide}
            aria-label="Next slide"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,18 15,12 9,6" />
            </svg>
          </button>
        </>
      )}

      {/* Dot navigation */}
      {showDots && total > 1 && (
        <div className={styles.dots}>
          {slides.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              onClick={() => jumpTo(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
