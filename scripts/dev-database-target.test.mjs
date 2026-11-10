import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateDevDatabaseTarget } from './dev-database-target.mjs'

const ref = 'abcdefghijklmnopqrst'
const direct = `postgresql://postgres:password@db.${ref}.supabase.co:5432/postgres`
const pooler = `postgresql://postgres.${ref}:password@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`

test('accepts the designated direct and session pooler connections', () => {
   assert.doesNotThrow(() => validateDevDatabaseTarget(direct, ref))
   assert.doesNotThrow(() => validateDevDatabaseTarget(pooler, ref))
})

test('rejects mismatched projects and connection overrides', () => {
   for (const url of [
      direct.replace(ref, 'zyxwvutsrqponmlkjihg'),
      pooler.replace(ref, 'zyxwvutsrqponmlkjihg'),
      pooler.replace(':5432/', ':6543/'),
      `${direct}?host=other.example`,
      direct.replace('supabase.co', 'supabase.co.evil.example'),
   ]) {
      assert.throws(() => validateDevDatabaseTarget(url, ref))
   }
   assert.throws(() => validateDevDatabaseTarget(direct, ''))
})
