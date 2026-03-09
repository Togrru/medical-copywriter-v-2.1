const { requireAuth } = require('./_auth')

function extractDocId(url) {
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
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
  if (!docId) return res.status(400).json({
    error: 'Не удалось извлечь ID документа. Скопируйте ссылку прямо из адресной строки браузера.'
  })

  const attempts = [
    `https://docs.google.com/document/d/${docId}/export?format=txt`,
    `https://docs.google.com/feeds/download/documents/export/Export?id=${docId}&exportFormat=txt`,
    `https://docs.google.com/document/d/${docId}/pub?output=text`,
  ]

  const errors = []

  for (const exportUrl of attempts) {
    try {
      const r = await fetch(exportUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
        redirect: 'follow',
      })

      if (r.status === 200) {
        const text = await r.text()
        if (!text.trim()) {
          return res.status(422).json({ error: 'Документ пустой' })
        }
        return res.json({
          docId,
          text: text.trim(),
          length: text.trim().length,
          preview: text.trim().slice(0, 300),
        })
      }

      if (r.status === 401 || r.status === 403) {
        return res.status(403).json({
          error: 'Доступ закрыт. Откройте документ → Поделиться → «Читатель — все, у кого есть ссылка».'
        })
      }

      errors.push(`${exportUrl.includes('pub') ? 'pub' : exportUrl.includes('feeds') ? 'feeds' : 'export'}: HTTP ${r.status}`)
    } catch (e) {
      errors.push(e.message)
    }
  }

  return res.status(502).json({
    error: 'Не удалось загрузить документ ни одним из методов.',
    debug: errors,
  })
}
