import { experimental_upgradeWebSocket } from '@vercel/functions'
import { getDatabase } from '../server/mongodb.js'

const sockets = new Set()
let changeStream = null
let listenerRetryTimer = null
let heartbeatTimer = null
const ANNOUNCEMENT_ID = 'homepage-announcement'

function toClientAnnouncement(document) {
  return {
    type: 'announcement',
    enabled: Boolean(document?.enabled && document?.text),
    text: typeof document?.text === 'string' ? document.text : '',
    updatedAt: document?.updatedAt instanceof Date ? document.updatedAt.toISOString() : document?.updatedAt || null,
  }
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

async function sendCurrentAnnouncement(ws) {
  const database = await getDatabase()
  const document = await database.collection('site_content').findOne(
    { _id: ANNOUNCEMENT_ID },
    { projection: { text: 1, enabled: 1, updatedAt: 1 } },
  )

  send(ws, toClientAnnouncement(document))
}

async function startChangeStream() {
  if (changeStream || listenerRetryTimer || sockets.size === 0) {
    return
  }

  try {
    const database = await getDatabase()
    changeStream = database.collection('site_content').watch(
      [{ $match: { 'documentKey._id': ANNOUNCEMENT_ID } }],
      { fullDocument: 'updateLookup' },
    )

    changeStream.on('change', (change) => {
      if (change.operationType === 'delete') {
        broadcast({
          type: 'announcement',
          enabled: false,
          text: '',
          updatedAt: new Date().toISOString(),
        })
        return
      }

      broadcast(toClientAnnouncement(change.fullDocument))
    })

    changeStream.on('error', () => {
      changeStream = null
      scheduleChangeStreamRetry()
    })

    changeStream.on('close', () => {
      changeStream = null
      scheduleChangeStreamRetry()
    })
  } catch {
    changeStream = null
    scheduleChangeStreamRetry()
  }
}

function scheduleChangeStreamRetry() {
  if (listenerRetryTimer || sockets.size === 0) {
    return
  }

  listenerRetryTimer = setTimeout(() => {
    listenerRetryTimer = null
    startChangeStream()
  }, 1500)
}

function stopChangeStreamWhenIdle() {
  if (sockets.size > 0) {
    return
  }

  clearTimeout(listenerRetryTimer)
  listenerRetryTimer = null

  if (changeStream) {
    changeStream.close().catch(() => {})
    changeStream = null
  }
}

function startHeartbeat() {
  if (heartbeatTimer) {
    return
  }

  heartbeatTimer = setInterval(() => {
    for (const ws of sockets) {
      try {
        if (ws.readyState === 1) {
          ws.ping()
        }
      } catch {
        sockets.delete(ws)
      }
    }

    stopChangeStreamWhenIdle()

    if (sockets.size === 0) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }, 20000)
}

export function GET() {
  return experimental_upgradeWebSocket(async (ws) => {
    sockets.add(ws)
    startHeartbeat()
    startChangeStream()

    ws.on('message', () => {
      // The public socket is receive-only. Ignore unexpected client payloads.
    })

    ws.on('close', () => {
      sockets.delete(ws)
      stopChangeStreamWhenIdle()
    })

    ws.on('error', () => {
      sockets.delete(ws)
      stopChangeStreamWhenIdle()
    })

    try {
      await sendCurrentAnnouncement(ws)
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
