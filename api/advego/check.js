const { requireAuth } = require('../_auth')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireAuth(req, res)) return

  const { key } = req.body || {}
  const token = process.env.ADVEGO_API_KEY
  if (!token) return res.status(500).json({ error: 'ADVEGO_API_KEY не задан' })
  if (!key)   return res.status(400).json({ error: 'key обязателен' })

  try {
    const r = await fetch('https://api.advego.com/json/antiplagiat/get/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'unique_check', id: 1,
        params: { token, key, report_json: '1' },
      }),
    })
    const data = await r.json()
    if (data.error) return res.status(502).json({ error: `Advego: ${JSON.stringify(data.error)}` })

    const result = data.result || {}
    if ((result.status || 'progress') !== 'done') return res.json({ status: result.status || 'progress' })

    const eq = parseFloat(result.equality ?? 0)
    const rw = parseFloat(result.rewrite  ?? 0)
    res.json({
      status: 'done',
      uniqueness_phrases: Math.round(100 - eq),
      uniqueness_words:   Math.round(100 - rw),
      equality: eq, rewrite: rw,
      sources: (result.sources || []).slice(0, 5).map(s => ({ url: s.url || '', percent: s.percent || 0 })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
