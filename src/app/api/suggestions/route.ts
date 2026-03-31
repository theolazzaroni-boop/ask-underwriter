import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import sql from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { question_id, question_description, product } = await req.json()

  if (!question_description) {
    return NextResponse.json({ error: 'question_description is required' }, { status: 400 })
  }

  // Fetch similar examples from knowledge base
  const examples = await sql`
    SELECT question_text, answer_text
    FROM knowledge_base
    WHERE (product = ${product} OR product IS NULL OR product = '')
    ORDER BY CASE WHEN product = ${product} THEN 0 ELSE 1 END, created_at DESC
    LIMIT 20
  `

  // Log the suggestion request
  if (question_id) {
    await sql`
      INSERT INTO suggestion_logs (question_id) VALUES (${question_id})
    `.catch(() => {}) // non-blocking
  }

  if (examples.length === 0) {
    return NextResponse.json({
      suggestion: null,
      based_on: 0,
      message: 'Pas encore assez de données pour générer une suggestion'
    })
  }

  const examplesText = examples.map((e, i) =>
    `---\nQuestion ${i + 1}: ${e.question_text}\nRéponse ${i + 1}: ${e.answer_text}`
  ).join('\n')

  const prompt = `Tu es un underwriter expert en assurance. Tu dois rédiger une réponse professionnelle à une demande commerciale.

Voici des exemples de réponses passées pour des demandes similaires${product ? ` sur le produit ${product}` : ''} :

${examplesText}

---
Nouvelle demande à traiter :
Description : ${question_description}

Rédige une réponse professionnelle, concise et directement utilisable.
Ne commence pas par "Bonjour" si les exemples ne commencent pas par "Bonjour".
Respecte le ton et le style des exemples ci-dessus.
Réponds uniquement avec le texte de la réponse, sans explication.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  })

  const suggestion = message.content[0].type === 'text' ? message.content[0].text : ''

  return NextResponse.json({ suggestion, based_on: examples.length })
}
