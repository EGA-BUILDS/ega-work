import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { validateDevDatabaseTarget } from './dev-database-target.mjs'

try {
   const env = parseEnv(await readFile('.env.dev', 'utf8'))
   const connectionString = validateDevDatabaseTarget(env.DEV_DATABASE_URL, env.DEV_SUPABASE_PROJECT_REF)
   await readFile('drizzle/meta/_journal.json')

   let ca
   try {
      ca = await readFile('certs/supabase-ca.crt', 'utf8')
   } catch (error) {
      if (error?.code !== 'ENOENT') throw error
   }

   const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, max: 1 })
   try {
      await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
      console.log('Development migrations applied.')
   } finally {
      await pool.end()
   }
} catch (error) {
   if (error?.code === 'ENOENT') {
      console.error('Missing .env.dev or migration journal. Configure .env.dev and generate a migration first.')
   } else if (['SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(error?.code)) {
      console.error('TLS certificate verification failed. Download the Supabase database CA to certs/supabase-ca.crt and retry.')
   } else {
      // Database errors may contain connection details; do not print them.
      console.error('Migration failed. Check the development database target, TLS, and migration files.')
   }
   process.exitCode = 1
}
