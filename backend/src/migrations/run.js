/**
 * Database migration runner
 * Runs all schema and function migrations
 */

import pg from 'pg'
import dotenv from 'dotenv'
import { schema, adminFunctions } from '../models/db.js'

dotenv.config()

const { Client } = pg

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cloudclawmac'
  })

  try {
    await client.connect()
    console.log('✓ Connected to database')

    // Run schema
    console.log('Running schema migrations...')
    await client.query(schema)
    console.log('✓ Schema created successfully')

    // Run admin functions
    console.log('Running admin function migrations...')
    await client.query(adminFunctions)
    console.log('✓ Admin functions created successfully')

    console.log('\n✅ All migrations completed successfully!')

  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
    console.log('\nDatabase connection closed')
  }
}

runMigrations()
