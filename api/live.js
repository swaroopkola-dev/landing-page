import { experimental_upgradeWebSocket } from '@vercel/functions'
import { getDatabase } from '../server/mongodb.js'

const ANNOUNCEMENT_ID = 'homepage-announcement'

function toClientAnnouncement(document) {
  return {
    type: 'announcement',
    enabled: Boolean(document?.enabled && document?.text),
    text: typeof document?.text === 'string' ? document.text : '',
    updatedAt: document?.updatedAt instanceof Date
      ? document.updatedAt.toISOString()
      : document?.updatedAt || null,
  }
}

async function readAnnouncement() {
  const database = await getDatabase()
  return database.collection('site_content').findOne(
    { _id: ANNOUNCEMENT_ID },
    { projection: { text: 1, enabled: 1, updatedAt: 1 } },
  )
}

function send(ws, payload) {
  try {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(payload))
    }
  } catch {
    // The next reconnect will create a fresh connection.
  }
}

export function GET() {
  return experimental_upgradeWebSocket(async (ws) => {
    ws.on('message', async (raw) => {
      let message

      try {
        message = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (message?.type !== 'sync') {
        return
      }

      try {
        const document = await readAnnouncement()
        const updatedAt = document?.updatedAt instanceof Date
          ? document.updatedAt.toISOString()
          : document?.updatedAt || null

        if (!message.updatedAt || message.updatedAt !== updatedAt) {
          send(ws, toClientAnnouncement(document))
        }
      } catch {
        // Keep the connection open; the client will retry the next sync.
      }
    })

    ws.on('error', () => {
      // The client owns reconnection; nothing else is required here.
    })

    try {
      const document = await readAnnouncement()
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
