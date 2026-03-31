import postgres from 'postgres'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const sql = postgres(process.env.DATABASE_NEON_DATABASE_URL!, { ssl: 'require', max: 1 })

const CSV_PATH = resolve(process.cwd(), 'bdd_ask_underwriter.csv')

function parseCSV(content: string) {
  // Handle BOM
  content = content.replace(/^\uFEFF/, '')
  const lines = content.split('\n')
  const headers = parseCSVLine(lines[0])

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim() })
    return row
  })
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else { inQuotes = !inQuotes }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

async function main() {
  // Create table
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

  // Create suggestion_logs table
  await sql`
    CREATE TABLE IF NOT EXISTS suggestion_logs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      question_id uuid,
      created_at timestamptz DEFAULT now()
    )
  `

  const content = readFileSync(CSV_PATH, 'utf-8')
  const rows = parseCSV(content)

  let imported = 0
  let skipped = 0

  for (const row of rows) {
    const questionText = row['Description détaillée'] || ''
    const product = row['Produit d\'assurance'] || row["Produit d'assurance"] || ''
    const answerText = row['Réponse souscripteur'] || row["Réponse souscripteur"] || ''

    if (!questionText.trim() || !answerText.trim()) {
      skipped++
      continue
    }

    await sql`
      INSERT INTO knowledge_base (product, question_text, answer_text, source)
      VALUES (${product}, ${questionText}, ${answerText}, 'csv_import')
    `
    imported++
  }

  console.log(`Done: ${imported} imported, ${skipped} skipped`)
  await sql.end()
}

main().catch(console.error)
