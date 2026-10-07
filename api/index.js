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

const rateWindowMs = 10 * 60 * 1000
const maxRequestsPerWindow = 20
const rateBuckets = new Map()

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

function isRealCalendarDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
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

app.use(['/api', ''], router)

export default app
