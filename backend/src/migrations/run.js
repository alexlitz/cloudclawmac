/**
 * Database migration runner
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { schema } from '../models/db.js'

dotenv.config()

const { Client } = pg

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cloudclawmac'
  })

  try {
    await client.connect()
    console.log('Connected to database')

    // Run schema
    await client.query(schema)
    console.log('Schema created successfully')

  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await client.end()
    console.log('Database connection closed')
  }
}

runMigrations()
