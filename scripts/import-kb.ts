import postgres from 'postgres'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const sql = postgres(process.env.DATABASE_NEON_DATABASE_URL!, { ssl: 'require', max: 1 })

const CSV_PATH = resolve('/Users/theo/Downloads/knowledge_base.csv')

function parseCSV(content: string): Record<string, string>[] {
  content = content.replace(/^\uFEFF/, '')
  const rows: Record<string, string>[] = []
  let pos = 0
  const len = content.length

  function parseField(): string {
    if (content[pos] === '"') {
      pos++
      let field = ''
      while (pos < len) {
        if (content[pos] === '"') {
          if (content[pos + 1] === '"') { field += '"'; pos += 2 }
          else { pos++; break }
        } else {
          field += content[pos++]
        }
      }
      return field
    } else {
      let field = ''
      while (pos < len && content[pos] !== ',' && content[pos] !== '\n' && content[pos] !== '\r') {
        field += content[pos++]
      }
      return field
    }
  }

  function parseLine(): string[] {
    const fields: string[] = []
    while (pos < len && content[pos] !== '\n' && content[pos] !== '\r') {
      fields.push(parseField())
      if (content[pos] === ',') pos++
    }
    if (content[pos] === '\r') pos++
    if (content[pos] === '\n') pos++
    return fields
  }

  const headers = parseLine().map(h => h.trim())

  while (pos < len) {
    if (content[pos] === '\r' || content[pos] === '\n') { pos++; continue }
    const values = parseLine()
    if (values.every(v => !v.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] || '').trim() })
    rows.push(row)
  }

  return rows
}

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      product text,
      question_text text NOT NULL,
      answer_text text NOT NULL,
      source text DEFAULT 'csv_import',
      created_at timestamptz DEFAULT now()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS suggestion_logs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      question_id uuid,
      created_at timestamptz DEFAULT now()
    )
  `

  // Clear previous csv imports
  await sql`DELETE FROM knowledge_base WHERE source = 'csv_import'`
  console.log('Cleared previous CSV imports')

  const content = readFileSync(CSV_PATH, 'utf-8')
  const rows = parseCSV(content)
  console.log(`Parsed ${rows.length} rows`)

  let imported = 0
  let skipped = 0

  // Batch inserts for speed
  const BATCH = 50
  const valid = rows.filter(r => r['question']?.trim() && r['answer']?.trim())
  skipped = rows.length - valid.length

  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH)
    await Promise.all(batch.map(r => sql`
      INSERT INTO knowledge_base (product, question_text, answer_text, source)
      VALUES (${r['product'] || ''}, ${r['question']}, ${r['answer']}, 'csv_import')
    `))
    imported += batch.length
    if (imported % 500 === 0) console.log(`${imported}/${valid.length}...`)
  }

  console.log(`Done: ${imported} imported, ${skipped} skipped`)
  await sql.end()
}

main().catch(console.error)
