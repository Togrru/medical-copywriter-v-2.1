const { requireAuth } = require('./_auth')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireAuth(req, res)) return

  const { text } = req.body || {}
  const apiKey = process.env.TURGENEV_API_KEY

  if (!apiKey) return res.status(500).json({
    error: 'TURGENEV_API_KEY не задан. Добавьте переменную в настройках Vercel → Settings → Environment Variables'
  })
  if (!text) return res.status(400).json({ error: 'text обязателен' })

  try {
    const qs   = new URLSearchParams({ api: 'risk', key: apiKey, more: '1' })
    const body = new URLSearchParams({ text })

    const r = await fetch(`https://turgenev.ashmanov.com/?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const raw = await r.text()
    console.log('[Turgenev] HTTP', r.status, '| preview:', raw.slice(0, 150))

    // Detect HTML error page (invalid key, limit exceeded, etc.)
    if (raw.trimStart().startsWith('<')) {
      return res.status(502).json({
        error: 'Тургенев вернул HTML вместо JSON. Вероятные причины: неверный API ключ, истёк лимит, или сервис недоступен.',
        debug: raw.slice(0, 400),
      })
    }

    if (!r.ok) {
      return res.status(502).json({ error: `Тургенев HTTP ${r.status}`, debug: raw.slice(0, 300) })
    }

    let data
    try { data = JSON.parse(raw) }
    catch { return res.status(502).json({ error: 'Тургенев: невалидный JSON', debug: raw.slice(0, 300) }) }

    const total_risk = data.score ?? data.total ?? 0
    const details = {
      repeats:     safe(data, ['repeats',     'povtory']),
      style:       safe(data, ['style',       'stilistika']),
      queries:     safe(data, ['queries',     'zapros']),
      water:       safe(data, ['water',       'vodnost']),
      readability: safe(data, ['readability', 'udobochitaemost']),
    }
    const link = data.link ? `https://turgenev.ashmanov.com/?t=${data.link}` : ''

    res.json({ total_risk, risk_label: label(total_risk), details, link })

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

function safe(d, keys) {
  for (const k of keys) {
    if (k in d) { const v = d[k]; return typeof v === 'object' ? parseFloat(v.score ?? v.points ?? 0) : parseFloat(v) }
  }
  return 0
}

function label(s) {
  if (s <= 4)  return 'low'
  if (s <= 8)  return 'medium'
  if (s <= 12) return 'high'
  return 'critical'
}
