import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Instagram,
  Menu,
  Minus,
  Plus,
  X,
} from 'lucide-react'

const gallery = [
  {
    src: 'https://images.unsplash.com/photo-1780805664774-ef6082baeb03?auto=format&fit=crop&fm=jpg&q=78&w=1800',
    alt: 'Warmly lit restaurant interior with wood and pendant lights',
    label: 'The dining room',
  },
  {
    src: 'https://images.unsplash.com/photo-1774989423979-6a7bf5add3f0?auto=format&fit=crop&fm=jpg&q=78&w=1800',
    alt: 'Intimate restaurant with glowing pendant lamps',
    label: 'After dark',
  },
  {
    src: 'https://images.unsplash.com/photo-1750943082231-0d84cfabc4dd?auto=format&fit=crop&fm=jpg&q=78&w=1600',
    alt: 'Elegant plated dish on a white ceramic plate',
    label: 'At the table',
  },
  {
    src: 'https://www.dsm-firmenich.com/en/businesses/taste-texture-health/solutions/health-wellbeing/salt-reduction/_jcr_content/root/responsivegrid/psgridtextimage/image2.coreimg.82.1024.jpeg/1723742478034/savory-salt.jpeg',
    alt: 'Chef carefully plating dishes in a professional kitchen',
    label: 'In the kitchen',
  },
]

const menuItems = {
  dinner: [
    ['Charred corn ribs', 'toasted sesame, lime leaf, whipped curd', '₹420'],
    ['Smoked beet tartare', 'cocoa nib, mustard greens, aged balsamic', '₹480'],
    ['Black garlic prawns', 'burnt lemon, green chilli, coriander oil', '₹760'],
    ['Fire-roasted pumpkin', 'brown butter, pepita, curry leaf', '₹540'],
    ['Coal-grilled lamb', 'tamarind glaze, crispy shallot, mint', '₹980'],
    ['Sea bass in banana leaf', 'coconut, kokum, green pepper', '₹1,180'],
  ],
  drinks: [
    ['Salted guava highball', 'guava, lime, smoked chilli, soda', '₹520'],
    ['House negroni', 'gin, bitter orange, vermouth, cacao', '₹680'],
    ['Kokum spritz', 'kokum, basil, sparkling wine, citrus', '₹540'],
    ['Charred pineapple cooler', 'pineapple, pepper, rosemary, tonic', '₹460'],
    ['Espresso martini', 'cold brew, vodka, palm sugar', '₹620'],
    ['Zero-proof old fashioned', 'black tea, orange, date, bitters', '₹420'],
  ],
  dessert: [
    ['Burnt honey custard', 'salted pistachio, orange blossom', '₹390'],
    ['Dark chocolate tart', 'miso caramel, sesame brittle', '₹460'],
    ['Mango & coconut', 'young coconut, lime granita, basil', '₹420'],
    ['Ragi brownie', 'jaggery, crème fraîche, cacao nib', '₹410'],
  ],
}

const testimonials = [
  {
    quote: 'The kind of place that makes an ordinary Tuesday feel worth dressing up for.',
    name: 'Aditi Rao',
    meta: 'Local guide · Hyderabad',
  },
  {
    quote: 'Warm service, genuinely thoughtful food, and a room you want to stay in.',
    name: 'Rahul Menon',
    meta: 'Regular guest',
  },
  {
    quote: 'Nothing feels overworked. Every plate has a clear idea, and the details land.',
    name: 'Maya Shah',
    meta: 'Food editor',
  },
]

function App() {
  const [activeMenu, setActiveMenu] = useState('dinner')
  const [menuOpen, setMenuOpen] = useState(false)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(null)
  const [reservationSent, setReservationSent] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [testimonialIndex, setTestimonialIndex] = useState(0)
  const [activeSection, setActiveSection] = useState('home')
  const [scrolled, setScrolled] = useState(false)
  const formRef = useRef(null)

  const activeItems = useMemo(() => menuItems[activeMenu], [activeMenu])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const sections = ['home', 'story', 'menu', 'space', 'visit']
    const observers = sections
      .map((id) => {
        const element = document.getElementById(id)
        if (!element) return null
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) setActiveSection(id)
          },
          { rootMargin: '-35% 0px -55% 0px' },
        )
        observer.observe(element)
        return observer
      })
      .filter(Boolean)

    return () => observers.forEach((observer) => observer.disconnect())
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen || bookingOpen || galleryIndex !== null ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen, bookingOpen, galleryIndex])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTestimonialIndex((current) => (current + 1) % testimonials.length)
    }, 6500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setBookingOpen(false)
        setGalleryIndex(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const scrollTo = (id) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const openBooking = () => {
    setReservationSent(false)
    setBookingSubmitting(false)
    setBookingError('')
    setBookingOpen(true)
  }

  const nextGallery = () => setGalleryIndex((current) => (current + 1) % gallery.length)
  const previousGallery = () => setGalleryIndex((current) => (current - 1 + gallery.length) % gallery.length)

  const submitReservation = async (event) => {
    event.preventDefault()
    if (bookingSubmitting) return

    setBookingSubmitting(true)
    setBookingError('')

    const formData = new FormData(event.currentTarget)
    const payload = {
      name: String(formData.get('name') || '').trim(),
      date: String(formData.get('date') || ''),
      time: String(formData.get('time') || ''),
      guests: Number(formData.get('guests') || 0),
      occasion: String(formData.get('occasion') || 'Dinner').trim(),
      note: String(formData.get('note') || '').trim(),
    }

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.message || 'We could not complete the booking. Please try again.')
      }

      setReservationSent(true)
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'We could not complete the booking. Please try again.')
    } finally {
      setBookingSubmitting(false)
    }
  }

  return (
    <div className="site-shell">
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="header-inner">
          <button className="wordmark" onClick={() => scrollTo('home')} aria-label="Back to top">
            EMBER <span>&</span> LEAF
          </button>

          <nav className="desktop-nav" aria-label="Primary">
            {[
              ['story', 'Our table'],
              ['menu', 'Menu'],
              ['space', 'The room'],
              ['visit', 'Visit'],
            ].map(([id, label]) => (
              <button key={id} className={activeSection === id ? 'active' : ''} onClick={() => scrollTo(id)}>
                {label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <span className="open-status"><i /> Open tonight · 5:30–11</span>
            <button className="reserve-button" onClick={openBooking}>Reserve a table</button>
            <button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu size={22} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section id="home" className="hero section-anchor">
          <div className="hero-media">
            <img
              src={gallery[0].src}
              alt={gallery[0].alt}
              fetchPriority="high"
              className="hero-image"
            />
          </div>
          <div className="hero-wash" />
          <div className="hero-content">
            <p className="eyebrow light">Seasonal kitchen · Hyderabad</p>
            <h1>Food with a<br /><em>little fire</em> in it.</h1>
            <p className="hero-copy">
              A neighbourhood dining room built around open flame, bright Indian flavours,
              and the simple pleasure of staying for one more plate.
            </p>
            <div className="hero-actions">
              <button className="button button-solid" onClick={openBooking}>
                Book a table <ArrowRight size={17} />
              </button>
              <button className="text-link light-link" onClick={() => scrollTo('menu')}>
                See tonight’s menu <ArrowDown size={16} />
              </button>
            </div>
          </div>
          <div className="hero-meta">
            <span>17.4269° N · 78.4071° E</span>
            <span>Made for lingering</span>
          </div>
          <button className="scroll-cue" onClick={() => scrollTo('story')} aria-label="Scroll to story">
            <span>Scroll</span><ArrowDown size={16} />
          </button>
        </section>

        <section id="story" className="story section section-anchor">
          <div className="section-kicker">01 / Our table</div>
          <div className="story-grid">
            <div className="story-copy">
              <p className="eyebrow">A restaurant, not a performance</p>
              <h2>We like our food<br /><em>simple, soulful,</em><br />and a little smoky.</h2>
              <p>
                EMBER & LEAF started with a very ordinary idea: cook good ingredients over fire,
                make the room warm, pour something cold, and let people take their time.
              </p>
              <p>
                The menu changes with the market. The plates borrow from home kitchens,
                coastal memory, late-night street food, and everywhere in between.
              </p>
              <button className="text-link dark-link" onClick={() => scrollTo('space')}>
                Step inside <ArrowRight size={16} />
              </button>
            </div>

            <div className="story-feature">
              <div className="feature-card feature-card-main">
                <img src={gallery[2].src} alt={gallery[2].alt} loading="lazy" />
                <span className="feature-caption">A plate, at its best</span>
              </div>
              <div className="feature-note">
                <span className="note-line" />
                <p>“Cook over fire. Season like you mean it.”</p>
                <small>— Arjun, kitchen notes, 2026</small>
              </div>
            </div>
          </div>
        </section>

        <section id="menu" className="menu-section section section-anchor">
          <div className="section-kicker">02 / The menu</div>
          <div className="menu-heading">
            <div>
              <p className="eyebrow">Dinner, drinks & a sweet ending</p>
              <h2>Tonight, <em>we’re sharing.</em></h2>
            </div>
            <p className="menu-note">
              Our menu is intentionally short. Expect small changes as the market changes.
            </p>
          </div>

          <div className="menu-tabs" role="tablist" aria-label="Menu categories">
            {[
              ['dinner', 'Kitchen'],
              ['drinks', 'Drinks'],
              ['dessert', 'After'],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeMenu === id}
                className={activeMenu === id ? 'active' : ''}
                onClick={() => setActiveMenu(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="menu-list">
            {activeItems.map(([name, detail, price], index) => (
              <article className="menu-row" key={name}>
                <span className="menu-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="menu-item-copy">
                  <h3>{name}</h3>
                  <p>{detail}</p>
                </div>
                <span className="menu-price">{price}</span>
              </article>
            ))}
          </div>

          <div className="menu-footer">
            <span>Vegetarian and alcohol-free options always available.</span>
            <button className="text-link dark-link" onClick={openBooking}>Ask about tonight <ArrowRight size={16} /></button>
          </div>
        </section>

        <section id="space" className="space section-anchor">
          <div className="space-copy">
            <p className="eyebrow light">03 / The room</p>
            <h2>Come for dinner.<br /><em>Stay for the room.</em></h2>
            <p>
              Low light, old timber, soft brass, and enough space between tables to hear the person
              you came with.
            </p>
            <div className="space-detail-grid">
              <div><span>Seats</span><strong>48</strong></div>
              <div><span>Tables</span><strong>14</strong></div>
              <div><span>Private room</span><strong>8</strong></div>
            </div>
          </div>
          <div className="space-image-wrap">
            <img src={gallery[1].src} alt={gallery[1].alt} loading="lazy" />
            <button className="image-button" onClick={() => setGalleryIndex(1)}>
              View the room <Plus size={18} />
            </button>
          </div>
        </section>

        <section className="gallery-section section">
          <div className="section-kicker">A few frames</div>
          <div className="gallery-grid">
            {gallery.map((item, index) => (
              <button className={`gallery-card gallery-${index + 1}`} key={item.label} onClick={() => setGalleryIndex(index)}>
                <img src={item.src} alt={item.alt} loading="lazy" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="quote-section section">
          <div className="quote-mark">“</div>
          <blockquote>{testimonials[testimonialIndex].quote}</blockquote>
          <div className="quote-byline">
            <strong>{testimonials[testimonialIndex].name}</strong>
            <span>{testimonials[testimonialIndex].meta}</span>
          </div>
          <div className="quote-controls">
            <button onClick={() => setTestimonialIndex((i) => (i - 1 + testimonials.length) % testimonials.length)} aria-label="Previous review"><ArrowRight size={16} className="flip-x" /></button>
            <span>{String(testimonialIndex + 1).padStart(2, '0')} / 03</span>
            <button onClick={() => setTestimonialIndex((i) => (i + 1) % testimonials.length)} aria-label="Next review"><ArrowRight size={16} /></button>
          </div>
        </section>

        <section id="visit" className="visit section section-anchor">
          <div className="section-kicker">04 / Visit</div>
          <div className="visit-grid">
            <div className="visit-intro">
              <p className="eyebrow">Find us after sunset</p>
              <h2>Good food is better<br /><em>when you can walk to it.</em></h2>
              <p>Road No. 12, Banjara Hills, Hyderabad.<br />A five-minute walk from the old lake road.</p>
              <button className="button button-outline" onClick={openBooking}>Reserve your evening <CalendarDays size={17} /></button>
            </div>

            <div className="visit-card">
              <div className="visit-row">
                <Clock3 size={18} />
                <div><span>Wednesday — Sunday</span><strong>5:30 PM — 11:00 PM</strong></div>
              </div>
              <div className="visit-row">
                <span className="mini-label">BAR</span>
                <div><span>Last pour</span><strong>10:45 PM</strong></div>
              </div>
              <div className="visit-row">
                <span className="mini-label">TABLES</span>
                <div><span>Reservations</span><strong>Recommended</strong></div>
              </div>
              <a className="map-link" href="https://maps.google.com/?q=Banjara+Hills+Hyderabad" target="_blank" rel="noreferrer">
                Open in Maps <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>

        <section className="closing section">
          <div className="closing-inner">
            <p className="eyebrow">Until next time</p>
            <h2>Meet us at the<br /><em>good end of the day.</em></h2>
            <button className="button button-solid" onClick={openBooking}>Book a table <ArrowRight size={17} /></button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top">
          <div>
            <button className="footer-brand" onClick={() => scrollTo('home')}>EMBER <span>&</span> LEAF</button>
            <p>Seasonal kitchen, open fire,<br />Banjara Hills · Hyderabad</p>
          </div>
          <div className="footer-links">
            <div>
              <span>Explore</span>
              <button onClick={() => scrollTo('story')}>Our table</button>
              <button onClick={() => scrollTo('menu')}>Menu</button>
              <button onClick={() => scrollTo('space')}>The room</button>
            </div>
            <div>
              <span>Follow</span>
              <a href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={15} /> Instagram</a>
              <button onClick={openBooking}>Reservations</button>
              <button onClick={() => scrollTo('visit')}>Directions</button>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 EMBER & LEAF</span>
          <span>Concept website · Crafted for the table</span>
        </div>
      </footer>

      {menuOpen && (
        <div className="overlay nav-overlay" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="overlay-panel">
            <div className="overlay-head">
              <span className="overlay-brand">EMBER & LEAF</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={23} /></button>
            </div>
            <div className="mobile-links">
              {[
                ['home', 'Home'],
                ['story', 'Our table'],
                ['menu', 'Menu'],
                ['space', 'The room'],
                ['visit', 'Visit'],
              ].map(([id, label], index) => (
                <button key={id} onClick={() => scrollTo(id)}>
                  <span>0{index + 1}</span>{label}
                </button>
              ))}
            </div>
            <div className="overlay-foot">
              <span>Open tonight · 5:30–11</span>
              <button className="button button-solid" onClick={() => { setMenuOpen(false); openBooking() }}>Reserve a table</button>
            </div>
          </div>
        </div>
      )}

      {bookingOpen && (
        <div className="overlay booking-overlay" role="dialog" aria-modal="true" aria-label="Reserve a table">
          <div className="booking-panel">
            <div className="overlay-head">
              <div>
                <span className="overlay-brand">RESERVATIONS</span>
                <p>Tell us when you’d like to stay awhile.</p>
              </div>
              <button onClick={() => setBookingOpen(false)} aria-label="Close reservations"><X size={23} /></button>
            </div>

            {!reservationSent ? (
              <form ref={formRef} className="booking-form" onSubmit={submitReservation}>
                <label>Guest name<input required name="name" placeholder="Your name" /></label>
                <div className="form-split">
                  <label>Date<input required type="date" name="date" /></label>
                  <label>Time
                    <select required name="time" defaultValue="">
                      <option value="" disabled>Select</option>
                      <option>5:30 PM</option>
                      <option>6:30 PM</option>
                      <option>7:30 PM</option>
                      <option>8:30 PM</option>
                      <option>9:30 PM</option>
                    </select>
                  </label>
                </div>
                <div className="form-split">
                  <label>Guests<input required min="1" max="10" type="number" name="guests" defaultValue="2" /></label>
                  <label>Occasion
                    <select name="occasion" defaultValue="Dinner">
                      <option>Dinner</option>
                      <option>Birthday</option>
                      <option>Anniversary</option>
                      <option>Just because</option>
                    </select>
                  </label>
                </div>
                <label>Anything we should know?<textarea name="note" rows="3" maxLength="500" placeholder="Dietary needs, a high chair, a birthday candle…" /></label>
                {bookingError && <p className="booking-error" role="alert">{bookingError}</p>}
                <button className="button button-solid full-width" type="submit" disabled={bookingSubmitting}>
                  {bookingSubmitting ? 'Booking…' : 'Request a table'} <ArrowRight size={17} />
                </button>
                <small>Your details are sent securely to the restaurant reservation system.</small>
              </form>
            ) : (
              <div className="booking-success">
                <div className="success-icon"><Check size={28} /></div>
                <p className="eyebrow">Reservation confirmed</p>
                <h3>Successfully booked</h3>
                <p>Your table request has been registered successfully.</p>
                <button className="button button-outline" onClick={() => setBookingOpen(false)}>Back to the room</button>
              </div>
            )}
          </div>
        </div>
      )}

      {galleryIndex !== null && (
        <div className="overlay lightbox-overlay" role="dialog" aria-modal="true" aria-label="Photo viewer">
          <button className="lightbox-close" onClick={() => setGalleryIndex(null)} aria-label="Close photo viewer"><X size={24} /></button>
          <button className="lightbox-nav left" onClick={previousGallery} aria-label="Previous photo"><ArrowRight size={22} className="flip-x" /></button>
          <figure className="lightbox-figure">
            <img src={gallery[galleryIndex].src} alt={gallery[galleryIndex].alt} />
            <figcaption><span>{gallery[galleryIndex].label}</span><span>{galleryIndex + 1} / {gallery.length}</span></figcaption>
          </figure>
          <button className="lightbox-nav right" onClick={nextGallery} aria-label="Next photo"><ArrowRight size={22} /></button>
        </div>
      )}
    </div>
  )
}

export default App