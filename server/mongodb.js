import { MongoClient } from 'mongodb'

let clientPromise

export async function getDatabase() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not configured')
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      // Serverless workload: keep each warm function instance deliberately small
      // to avoid multiplying idle connections across Vercel instances.
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      waitQueueTimeoutMS: 3000,
    })

    clientPromise = client.connect()
  }

  const client = await clientPromise
  return client.db(process.env.MONGODB_DB || 'ember_leaf')
}
