import crypto from 'node:crypto'
import express from 'express'
import helmet from 'helmet'
import { z } from 'zod'
import { getDatabase } from '../server/mongodb.js'

const app = express()
const router = express.Router()

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

app.use(express.json({ limit: '12kb', strict: true }))

const bookingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.enum(['5:30 PM', '6:30 PM', '7:30 PM', '8:30 PM', '9:30 PM']),
  guests: z.number().int().min(1).max(10),
  occasion: z.string().trim().min(1).max(40),
  note: z.string().trim().max(500).optional().default(''),
})

const attendanceSchema = z.object({
  attendanceStatus: z.enum(['came', 'did_not_come']),
})

const announcementSchema = z.object({
  text: z.string().trim().max(180),
  enabled: z.boolean(),
})

const rateWindowMs = 10 * 60 * 1000
const maxRequestsPerWindow = 20
const loginWindowMs = 15 * 60 * 1000
const maxLoginAttemptsPerWindow = 10
const rateBuckets = new Map()
const loginBuckets = new Map()

const ADMIN_SESSION_COOKIE = 'ember_admin_session'
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000
const ADMIN_PASSWORD_SALT = 'a0bba900c268806cc2687ff8e3361a90'
const ADMIN_PASSWORD_HASH = '90795198681894de8f7c48a4a57092ea86c3b2b72ec2395cfafe34c406d53be94b772fe42f00498aa5e689b5f37e8d77c31df31315b8d18364b7f8af6a417691'

function requestKey(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
}

function rateLimit(req, res, next) {
  const now = Date.now()
  const key = requestKey(req)
  const bucket = rateBuckets.get(key)

  if (!bucket || now - bucket.startedAt >= rateWindowMs) {
    rateBuckets.set(key, { count: 1, startedAt: now })
    return next()
  }

  if (bucket.count >= maxRequestsPerWindow) {
    return res.status(429).json({
      success: false,
      message: 'Too many booking attempts. Please try again shortly.',
    })
  }

  bucket.count += 1
  return next()
}

function loginRateLimit(req, res, next) {
  const now = Date.now()
  const key = requestKey(req)
  const bucket = loginBuckets.get(key)

  if (!bucket || now - bucket.startedAt >= loginWindowMs) {
    loginBuckets.set(key, { count: 1, startedAt: now })
    return next()
  }

  if (bucket.count >= maxLoginAttemptsPerWindow) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
    })
  }

  bucket.count += 1
  return next()
}

function isRealCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || 'admin'
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function getAdminPasswordHash(password) {
  return crypto.scryptSync(
    password,
    ADMIN_PASSWORD_SALT,
    64,
    { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 },
  ).toString('hex')
}

function verifyAdminPassword(password) {
  return safeEqual(getAdminPasswordHash(password), ADMIN_PASSWORD_HASH)
}

function getSessionSecret() {
  const mongoUri = process.env.MONGODB_URI || ''
  return crypto.createHash('sha256').update('ember-leaf-admin-session:v1').update(mongoUri).digest('hex')
}

function signSession(payload) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

function createAdminSession(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
  })).toString('base64url')

  return `${payload}.${signSession(payload)}`
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=')
    if (separator === -1) return cookies
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    cookies[key] = decodeURIComponent(value)
    return cookies
  }, {})
}

function readAdminSession(req) {
  const username = getAdminUsername()
  if (!username || !process.env.MONGODB_URI) return null

  const cookie = parseCookies(req.headers.cookie || '')[ADMIN_SESSION_COOKIE]
  if (!cookie) return null

  const [payload, signature] = cookie.split('.')
  if (!payload || !signature) return null

  const expectedSignature = signSession(payload)
  if (!safeEqual(signature, expectedSignature)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (session.username !== username || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      return null
    }

    return session
  } catch {
    return null
  }
}

function setAdminCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}`,
  )
}

function clearAdminCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  )
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin')
  if (!origin) return next()

  const expectedOrigin = `${req.protocol}://${req.get('host')}`
  if (origin !== expectedOrigin) {
    return res.status(403).json({ success: false, message: 'Request origin is not allowed.' })
  }

  return next()
}

function requireAdmin(req, res, next) {
  const session = readAdminSession(req)
  if (!session) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: 'Admin authentication required.',
    })
  }

  req.admin = session
  return next()
}

router.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

router.post('/bookings', rateLimit, async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Please check your booking details and try again.',
      fields: parsed.error.flatten().fieldErrors,
    })
  }

  if (!isRealCalendarDate(parsed.data.date)) {
    return res.status(400).json({
      success: false,
      message: 'Please choose a valid date.',
    })
  }

  const bookingId = `EL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
  const createdAt = new Date()

  try {
    const database = await getDatabase()
    await database.collection('restaurant').insertOne({
      bookingId,
      status: 'confirmed',
      attendanceStatus: 'pending',
      name: parsed.data.name,
      date: parsed.data.date,
      time: parsed.data.time,
      guests: parsed.data.guests,
      occasion: parsed.data.occasion,
      note: parsed.data.note,
      source: 'website',
      environment: process.env.VERCEL_ENV || 'production',
      createdAt,
    })

    return res.status(201).json({
      success: true,
      message: 'Successfully booked',
      bookingId,
    })
  } catch (error) {
    console.error('Booking creation failed', {
      error: error instanceof Error ? error.message : String(error),
      bookingId,
    })

    return res.status(503).json({
      success: false,
      message: 'We could not complete the booking right now. Please try again in a moment.',
    })
  }
})

router.post('/admin/login', loginRateLimit, requireSameOrigin, (req, res) => {
  const loginSchema = z.object({
    username: z.string().min(1).max(80),
    password: z.string().min(1).max(200),
  })
  const parsed = loginSchema.safeParse(req.body)
  const username = getAdminUsername()

  if (!process.env.MONGODB_URI) {
    return res.status(503).json({
      success: false,
      message: 'Admin access is not configured.',
    })
  }

  if (!parsed.success || !safeEqual(parsed.data.username, username) || !verifyAdminPassword(parsed.data.password)) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: 'Invalid admin credentials.',
    })
  }

  setAdminCookie(res, createAdminSession(username))
  return res.status(200).json({
    success: true,
    authenticated: true,
  })
})

router.get('/admin/session', (req, res) => {
  const session = readAdminSession(req)
  return res.status(200).json({
    success: true,
    authenticated: Boolean(session),
    username: session?.username || null,
  })
})

router.post('/admin/logout', requireSameOrigin, (_req, res) => {
  clearAdminCookie(res)
  return res.status(200).json({
    success: true,
    authenticated: false,
  })
})

router.get('/admin/bookings', requireAdmin, async (req, res) => {
  const rawLimit = Number.parseInt(req.query.limit, 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100

  try {
    const database = await getDatabase()
    const bookings = await database.collection('restaurant').find(
      { environment: 'production', source: 'website' },
      {
        projection: {
          _id: 0,
          bookingId: 1,
          status: 1,
          attendanceStatus: 1,
          attendanceMarkedAt: 1,
          attendanceMarkedBy: 1,
          name: 1,
          date: 1,
          time: 1,
          guests: 1,
          occasion: 1,
          note: 1,
          createdAt: 1,
        },
        limit,
        sort: { createdAt: -1 },
      },
    ).toArray()

    return res.status(200).json({
      success: true,
      bookings,
      count: bookings.length,
    })
  } catch (error) {
    console.error('Admin booking history failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return res.status(503).json({
      success: false,
      message: 'Booking history is temporarily unavailable.',
    })
  }
})

router.patch('/admin/bookings/:bookingId/attendance', requireAdmin, requireSameOrigin, async (req, res) => {
  const bookingId = String(req.params.bookingId || '')
  const parsed = attendanceSchema.safeParse(req.body)

  if (!/^EL-\d{8}-[A-F0-9]{8}$/.test(bookingId) || !parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid attendance update.',
    })
  }

  try {
    const database = await getDatabase()
    const update = {
      $set: {
        attendanceStatus: parsed.data.attendanceStatus,
        attendanceMarkedAt: new Date(),
        attendanceMarkedBy: req.admin.username,
      },
    }

    const result = await database.collection('restaurant').updateOne(
      { bookingId, environment: 'production', source: 'website' },
      update,
    )

    if (!result.matchedCount) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found.',
      })
    }

    return res.status(200).json({
      success: true,
      bookingId,
      attendanceStatus: parsed.data.attendanceStatus,
    })
  } catch (error) {
    console.error('Attendance update failed', {
      error: error instanceof Error ? error.message : String(error),
      bookingId,
    })

    return res.status(503).json({
      success: false,
      message: 'We could not save that attendance update. Please try again.',
    })
  }
})


router.get('/admin/announcement', requireAdmin, async (_req, res) => {
  try {
    const database = await getDatabase()
    const announcement = await database.collection('site_content').findOne(
      { _id: 'homepage-announcement' },
      { projection: { _id: 0, text: 1, enabled: 1, updatedAt: 1, updatedBy: 1 } },
    )

    return res.status(200).json({
      success: true,
      announcement: announcement
        ? {
            text: announcement.text || '',
            enabled: Boolean(announcement.enabled),
            updatedAt: announcement.updatedAt || null,
            updatedBy: announcement.updatedBy || null,
          }
        : {
            text: '',
            enabled: false,
            updatedAt: null,
            updatedBy: null,
          },
    })
  } catch (error) {
    console.error('Admin announcement load failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return res.status(503).json({
      success: false,
      message: 'The live message is temporarily unavailable.',
    })
  }
})

router.put('/admin/announcement', requireAdmin, requireSameOrigin, async (req, res) => {
  const parsed = announcementSchema.safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a message up to 180 characters and choose whether it should be visible.',
    })
  }

  const now = new Date()

  try {
    const database = await getDatabase()
    await database.collection('site_content').updateOne(
      { _id: 'homepage-announcement' },
      {
        $set: {
          text: parsed.data.text,
          enabled: parsed.data.enabled && parsed.data.text.length > 0,
          updatedAt: now,
          updatedBy: req.admin.username,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    )

    return res.status(200).json({
      success: true,
      announcement: {
        text: parsed.data.text,
        enabled: parsed.data.enabled && parsed.data.text.length > 0,
        updatedAt: now,
        updatedBy: req.admin.username,
      },
    })
  } catch (error) {
    console.error('Admin announcement update failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    return res.status(503).json({
      success: false,
      message: 'We could not publish that message. Please try again.',
    })
  }
})

app.use(['/api', ''], router)

export default app
