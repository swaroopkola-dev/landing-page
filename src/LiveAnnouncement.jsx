import { useEffect, useState } from 'react'
import './LiveAnnouncement.css'

const MAX_RECONNECT_DELAY = 10000

function applyAnnouncement(setAnnouncement, payload) {
  if (!payload || payload.type !== 'announcement') {
    return
  }

  setAnnouncement((current) => {
    if (current?.updatedAt && payload.updatedAt) {
      const currentTime = new Date(current.updatedAt).getTime()
      const nextTime = new Date(payload.updatedAt).getTime()
      if (Number.isFinite(currentTime) && Number.isFinite(nextTime) && nextTime < currentTime) {
        return current
      }
    }

    return {
      enabled: Boolean(payload.enabled && payload.text),
      text: typeof payload.text === 'string' ? payload.text : '',
      updatedAt: payload.updatedAt || null,
    }
  })
}

export default function LiveAnnouncement() {
  const [announcement, setAnnouncement] = useState(null)

  useEffect(() => {
    if (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')) {
      return undefined
    }

    let socket
    let reconnectTimer
    let syncTimer
    let reconnectDelay = 500
    let cancelled = false
    const announcementRef = { current: null }

    const connect = () => {
      if (cancelled) return

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      socket = new WebSocket(`${protocol}://${window.location.host}/api/live`)

      socket.addEventListener('open', () => {
        reconnectDelay = 500
      })

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data)
          applyAnnouncement((updater) => {
            setAnnouncement((current) => {
              const next = typeof updater === 'function' ? updater(current) : updater
              announcementRef.current = next
              return next
            })
          }, payload)
        } catch {
          // Ignore malformed public socket messages.
        }
      })

      window.clearInterval(syncTimer)
      syncTimer = window.setInterval(() => {
        if (socket?.readyState !== WebSocket.OPEN) return

        socket.send(JSON.stringify({
          type: 'sync',
          updatedAt: announcementRef.current?.updatedAt || null,
        }))
      }, 1500)

      socket.send(JSON.stringify({
        type: 'sync',
        updatedAt: announcementRef.current?.updatedAt || null,
      }))

      socket.addEventListener('close', () => {
        if (cancelled) return
        reconnectTimer = window.setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
          connect()
        }, reconnectDelay)
      })

      socket.addEventListener('error', () => {
        socket?.close()
      })
    }

    connect()

    return () => {
      cancelled = true
      window.clearTimeout(reconnectTimer)
      window.clearInterval(syncTimer)
      socket?.close()
    }
  }, [])

  if (!announcement?.enabled || !announcement.text) {
    return null
  }

  return (
    <aside className="live-announcement" aria-live="polite">
      <span className="live-announcement-dot" aria-hidden="true" />
      <span className="live-announcement-label">House note</span>
      <span className="live-announcement-copy">{announcement.text}</span>
    </aside>
  )
}
