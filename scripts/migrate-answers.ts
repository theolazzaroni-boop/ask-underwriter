import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_NEON_DATABASE_URL!, { ssl: 'require', max: 1 })

async function main() {
  await sql`ALTER TABLE answers ADD COLUMN IF NOT EXISTS source text DEFAULT 'web'`
  await sql`ALTER TABLE answers ADD COLUMN IF NOT EXISTS slack_message_ts text`
  await sql`ALTER TABLE answers ADD COLUMN IF NOT EXISTS author_name text`
  console.log('Migration done')
  await sql.end()
}
main().catch(console.error)
