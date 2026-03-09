const { requireAuth } = require('./_auth')

const BASE_SYSTEM = `Ты — профессиональный медицинский копирайтер для многопрофильной клиники.

ТРЕБОВАНИЯ К ТЕКСТАМ:

1. ТУРГЕНЕВ (риск Баден-Баден):
   — Избегай повторения ключевых слов, используй синонимы
   — Пиши живым языком, без канцеляризмов («осуществляется», «проводится», «является»)
   — Каждое предложение несёт смысл, никакой воды
   — Для медтекстов балл 6–8 по Тургеневу — норма

2. ADVEGO (техническая уникальность):
   — Не используй шаблоны: «наши специалисты», «индивидуальный подход», «современное оборудование»
   — Конкретика вместо общих слов: не «опытный врач», а «хирург с 15 годами практики»
   — Варьируй синтаксис: чередуй короткие и длинные предложения
   — Целевая уникальность по фразам: ≥ 85%

3. МЕДИЦИНСКАЯ ДОСТОВЕРНОСТЬ:
   — Не делай прямых диагностических обещаний
   — Используй: «может помочь», «рекомендуется», «специалист определит»
   — Не обещай 100% результат лечения`

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireAuth(req, res)) return

  const {
    messages,          // [{role, content}] — полная история диалога
    mode = 'chat',     // 'clarify' | 'confirm_tz' | 'generate' | 'refine'
    systemPrompt,      // переопределение системного промпта из настроек
    globalDoc,         // текст глобального Google Doc (общее ТЗ проекта)
    taskDoc,           // текст Google Doc конкретного задания
  } = req.body || {}

  const apiKey = process.env.OPENROUTER_API_KEY
  const model  = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'

  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY не задан' })
  if (!messages?.length) return res.status(400).json({ error: 'messages обязательны' })

  // Build system prompt
  let system = systemPrompt || BASE_SYSTEM

  // Attach context documents
  const contextParts = []
  if (globalDoc?.trim()) {
    contextParts.push(`=== ОБЩЕЕ ТЗ ПРОЕКТА (из Google Docs) ===\n${globalDoc.trim()}`)
  }
  if (taskDoc?.trim()) {
    contextParts.push(`=== ТЗ КОНКРЕТНОГО ЗАДАНИЯ (из Google Docs) ===\n${taskDoc.trim()}`)
  }
  if (contextParts.length) {
    system += '\n\n' + contextParts.join('\n\n')
  }

  // Mode-specific instructions
  if (mode === 'confirm_tz') {
    system += `\n\nЗАДАЧА: Пользователь загрузил документ с техническим заданием. Прочти его и кратко подтверди что понял — перечисли: тему/заголовок, тип текста, ключевые слова, объём, особые требования. Если чего-то не хватает — спроси. Отвечай по-русски, кратко и по делу.`
  } else if (mode === 'generate') {
    system += `\n\nЗАДАЧА: Сгенерируй текст строго по ТЗ выше. Отвечай ТОЛЬКО готовым текстом, без вступлений, пояснений и комментариев.`
  } else if (mode === 'refine') {
    system += `\n\nРЕЖИМ ДОРАБОТКИ: Пользователь даёт правки к сгенерированному тексту. Если просит исправить — верни ТОЛЬКО исправленный текст. Если задаёт вопрос — ответь на него.`
  }
  // mode === 'clarify' — обычный чат, без дополнительных инструкций

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://medical-copywriter.vercel.app',
        'X-Title': 'Medical Copywriter',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 4000,
        temperature: mode === 'generate' ? 0.75 : 0.6,
      }),
    })

    if (!r.ok) {
      const t = await r.text()
      return res.status(502).json({ error: `OpenRouter: ${t}` })
    }

    const data = await r.json()
    const reply = data.choices?.[0]?.message?.content?.trim() || ''
    res.json({ reply })

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
