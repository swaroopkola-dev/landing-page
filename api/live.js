import { experimental_upgradeWebSocket } from '@vercel/functions'
import { getDatabase } from '../server/mongodb.js'

const sockets = new Set()
let pollTimer = null
let polling = false
let lastFingerprint = null
const ANNOUNCEMENT_ID = 'homepage-announcement'
const POLL_MS = 1200

function toClientAnnouncement(document) {
  return {
    type: 'announcement',
    enabled: Boolean(document?.enabled && document?.text),
    text: typeof document?.text === 'string' ? document.text : '',
    updatedAt: document?.updatedAt instanceof Date ? document.updatedAt.toISOString() : document?.updatedAt || null,
  }
}

function fingerprint(document) {
  const updatedAt = document?.updatedAt instanceof Date
    ? document.updatedAt.toISOString()
    : document?.updatedAt || ''

  return JSON.stringify({
    text: document?.text || '',
    enabled: Boolean(document?.enabled),
    updatedAt,
  })
}

function send(ws, payload) {
  try {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload))
    }
  } catch {
    sockets.delete(ws)
  }
}

function broadcast(payload) {
  for (const ws of sockets) {
    send(ws, payload)
  }
}

async function readAnnouncement() {
  const database = await getDatabase()
  return database.collection('site_content').findOne(
    { _id: ANNOUNCEMENT_ID },
    { projection: { text: 1, enabled: 1, updatedAt: 1 } },
  )
}

async function pollAnnouncement() {
  if (polling || sockets.size === 0) {
    return
  }

  polling = true

  try {
    const document = await readAnnouncement()
    const nextFingerprint = fingerprint(document)

    if (lastFingerprint === null) {
      lastFingerprint = nextFingerprint
    } else if (nextFingerprint !== lastFingerprint) {
      lastFingerprint = nextFingerprint
      broadcast(toClientAnnouncement(document))
    }
  } catch {
    // Keep the socket alive. The next interval retries automatically.
  } finally {
    polling = false
  }
}

function startPolling() {
  if (pollTimer || sockets.size === 0) {
    return
  }

  pollTimer = setInterval(() => {
    void pollAnnouncement()
  }, POLL_MS)

  void pollAnnouncement()
}

function stopPollingWhenIdle() {
  if (sockets.size > 0) {
    return
  }

  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }

  lastFingerprint = null
}

export function GET() {
  return experimental_upgradeWebSocket(async (ws) => {
    sockets.add(ws)
    startHeartbeat()
    startPolling()

    ws.on('message', () => {
      // The public socket is receive-only. Ignore unexpected client payloads.
    })

    ws.on('close', () => {
      sockets.delete(ws)
      stopPollingWhenIdle()
    })

    ws.on('error', () => {
      sockets.delete(ws)
      stopChangeStreamWhenIdle()
    })

    try {
      const document = await readAnnouncement()
      lastFingerprint = fingerprint(document)
      send(ws, toClientAnnouncement(document))
    } catch {
      send(ws, {
        type: 'announcement',
        enabled: false,
        text: '',
        updatedAt: null,
      })
    }
  }, {
    maxPayload: 1024,
  })
}
