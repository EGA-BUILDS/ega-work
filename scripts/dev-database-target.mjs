export function validateDevDatabaseTarget(connectionString, projectRef) {
   if (!/^[a-z0-9]{20}$/.test(projectRef ?? '')) {
      throw new Error('Set DEV_SUPABASE_PROJECT_REF to the designated development project reference.')
   }

   let url
   try {
      url = new URL(connectionString)
   } catch {
      throw new Error('Set DEV_DATABASE_URL to the development database connection string.')
   }

   const direct = url.hostname === `db.${projectRef}.supabase.co` && url.username === 'postgres'
   const sessionPooler =
      /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
      url.username === `postgres.${projectRef}`

   if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !(direct || sessionPooler) ||
      (url.port && url.port !== '5432') ||
      url.pathname !== '/postgres' ||
      !url.password ||
      url.search ||
      url.hash
   ) {
      throw new Error('Database URL must match the designated Supabase project and use its direct or session connection on port 5432, without query parameters.')
   }
   return url.toString()
}
