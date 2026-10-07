import './AdminPanel.css'
import { useEffect, useMemo, useState } from 'react'
import { Check, LogIn, LogOut, RefreshCw, ShieldCheck, X } from 'lucide-react'

function formatCreatedAt(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatReservationDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function AttendanceButton({ active, kind, disabled, onClick }) {
  const isCame = kind === 'came'
  return (
    <button
      type="button"
      className={`admin-attendance-button ${isCame ? 'is-came' : 'is-no-show'} ${active ? 'is-active' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {isCame ? <Check size={14} /> : <X size={14} />}
      {isCame ? 'Came' : 'No-show'}
    </button>
  )
}

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginSubmitting, setLoginSubmitting] = useState(false)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [updatingBookingId, setUpdatingBookingId] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const counts = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter((booking) => !booking.attendanceStatus || booking.attendanceStatus === 'pending').length,
    came: bookings.filter((booking) => booking.attendanceStatus === 'came').length,
    noShow: bookings.filter((booking) => booking.attendanceStatus === 'did_not_come').length,
  }), [bookings])

  const loadBookings = async () => {
    setLoading(true)
    setLoadError('')

    try {
      const response = await fetch('/api/admin/bookings', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))

      if (response.status === 401) {
        setAuthenticated(false)
        setBookings([])
        return
      }

      if (!response.ok) {
        throw new Error(result.message || 'Unable to load reservations.')
      }

      setAuthenticated(true)
      setBookings(Array.isArray(result.bookings) ? result.bookings : [])
      setLastUpdated(new Date())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load reservations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/admin/session', {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        const result = await response.json().catch(() => ({}))

        if (result.authenticated) {
          setAuthenticated(true)
          setUsername(result.username || '')
        }
      } catch {
        setLoadError('Unable to connect to the admin service.')
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [])

  useEffect(() => {
    if (authenticated) {
      loadBookings()
    }
  }, [authenticated])

  const handleLogin = async (event) => {
    event.preventDefault()
    if (loginSubmitting) return

    setLoginSubmitting(true)
    setLoginError('')

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.message || 'Unable to sign in.')
      }

      setUsername(loginUsername.trim())
      setLoginPassword('')
      setAuthenticated(true)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in.')
    } finally {
      setLoginSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {})
    setAuthenticated(false)
    setUsername('')
    setBookings([])
  }

  const updateAttendance = async (bookingId, attendanceStatus) => {
    setUpdatingBookingId(bookingId)
    setLoadError('')

    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/attendance`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceStatus }),
      })
      const result = await response.json().catch(() => ({}))

      if (response.status === 401) {
        setAuthenticated(false)
        setBookings([])
        return
      }

      if (!response.ok) {
        throw new Error(result.message || 'Unable to update attendance.')
      }

      setBookings((current) => current.map((booking) => (
        booking.bookingId === bookingId
          ? {
              ...booking,
              attendanceStatus,
              attendanceMarkedAt: new Date().toISOString(),
              attendanceMarkedBy: username,
            }
          : booking
      )))
      setLastUpdated(new Date())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to update attendance.')
    } finally {
      setUpdatingBookingId('')
    }
  }

  if (!authenticated) {
    return (
      <main className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-brand">EMBER <span>&</span> LEAF</div>
          <div className="admin-lock"><ShieldCheck size={24} strokeWidth={1.5} /></div>
          <p className="admin-eyebrow">Private access</p>
          <h1>Reservation desk</h1>
          <p className="admin-intro">Sign in to review table reservations and confirm arrivals.</p>

          <form className="admin-login-form" onSubmit={handleLogin}>
            <label>
              Admin username
              <input
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {loginError ? <p className="admin-error" role="alert">{loginError}</p> : null}
            <button className="admin-primary-button" type="submit" disabled={loginSubmitting}>
              <LogIn size={16} />
              {loginSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <a className="admin-back-link" href="/">← Back to restaurant</a>
        </div>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <div className="admin-brand">EMBER <span>&</span> LEAF</div>
          <p className="admin-eyebrow">Private reservation desk</p>
        </div>
        <div className="admin-header-actions">
          <span className="admin-signed-in">Signed in as <strong>{username || 'admin'}</strong></span>
          <button type="button" className="admin-icon-button" onClick={loadBookings} disabled={loading} aria-label="Refresh reservations">
            <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
          </button>
          <button type="button" className="admin-secondary-button" onClick={handleLogout}>
            <LogOut size={15} /> Log out
          </button>
        </div>
      </header>

      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Reservation history</p>
          <h1>Tonight’s table book.</h1>
          <p>Every website reservation is listed here in reverse chronological order.</p>
        </div>
        <div className="admin-last-updated">
          <span>Last updated</span>
          <strong>{lastUpdated ? formatCreatedAt(lastUpdated) : '—'}</strong>
        </div>
      </section>

      <section className="admin-stats" aria-label="Reservation summary">
        <div><span>All</span><strong>{counts.total}</strong></div>
        <div><span>Pending</span><strong>{counts.pending}</strong></div>
        <div><span>Came</span><strong>{counts.came}</strong></div>
        <div><span>No-show</span><strong>{counts.noShow}</strong></div>
      </section>

      {loadError ? <p className="admin-error admin-global-error" role="alert">{loadError}</p> : null}

      <section className="admin-history">
        <div className="admin-history-head">
          <div>
            <p className="admin-eyebrow">Bookings</p>
            <h2>Table history</h2>
          </div>
          <span>{bookings.length} reservation{bookings.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div className="admin-empty">Loading reservations…</div>
        ) : bookings.length === 0 ? (
          <div className="admin-empty">
            <strong>No reservations yet.</strong>
            <span>New website bookings will appear here.</span>
          </div>
        ) : (
          <div className="admin-booking-list">
            {bookings.map((booking) => {
              const attendance = booking.attendanceStatus || 'pending'
              const updating = updatingBookingId === booking.bookingId

              return (
                <article className="admin-booking-card" key={booking.bookingId}>
                  <div className="admin-booking-main">
                    <div className="admin-booking-title">
                      <div>
                        <span className="admin-booking-id">{booking.bookingId}</span>
                        <h3>{booking.name}</h3>
                      </div>
                      <span className={`admin-status-badge ${attendance}`}>
                        {attendance === 'came' ? 'Came' : attendance === 'did_not_come' ? 'No-show' : 'Pending'}
                      </span>
                    </div>

                    <div className="admin-booking-details">
                      <div><span>Date</span><strong>{formatReservationDate(booking.date)}</strong></div>
                      <div><span>Time</span><strong>{booking.time}</strong></div>
                      <div><span>Guests</span><strong>{booking.guests}</strong></div>
                      <div><span>Occasion</span><strong>{booking.occasion}</strong></div>
                    </div>

                    {booking.note ? <p className="admin-booking-note">“{booking.note}”</p> : null}

                    <div className="admin-booking-meta">
                      <span>Booked {formatCreatedAt(booking.createdAt)}</span>
                      {booking.attendanceMarkedAt ? (
                        <span>
                          Marked {attendance === 'came' ? 'came' : 'no-show'} {formatCreatedAt(booking.attendanceMarkedAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="admin-booking-actions">
                    <AttendanceButton
                      kind="came"
                      active={attendance === 'came'}
                      disabled={updating}
                      onClick={() => updateAttendance(booking.bookingId, 'came')}
                    />
                    <AttendanceButton
                      kind="no-show"
                      active={attendance === 'did_not_come'}
                      disabled={updating}
                      onClick={() => updateAttendance(booking.bookingId, 'did_not_come')}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
