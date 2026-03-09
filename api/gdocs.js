const { requireAuth } = require('./_auth')

// Extract Google Doc ID from various URL formats
function extractDocId(url) {
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireAuth(req, res)) return

  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url обязателен' })

  const docId = extractDocId(url)
  if (!docId) return res.status(400).json({ error: 'Не удалось извлечь ID документа из ссылки' })

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`

  try {
    const r = await fetch(exportUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    })

    if (r.status === 401 || r.status === 403) {
      return res.status(403).json({
        error: 'Документ закрыт. Откройте доступ: Файл → Настройки доступа → «Читатель» для всех с ссылкой',
      })
    }

    if (!r.ok) {
      return res.status(502).json({ error: `Google вернул HTTP ${r.status}` })
    }

    const text = await r.text()
    if (!text.trim()) {
      return res.status(422).json({ error: 'Документ пустой или не удалось прочитать содержимое' })
    }

    res.json({
      docId,
      text: text.trim(),
      length: text.trim().length,
      preview: text.trim().slice(0, 300),
    })

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
