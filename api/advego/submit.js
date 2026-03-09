const { requireAuth } = require('../_auth')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireAuth(req, res)) return

  const { text, title = '' } = req.body || {}
  const token = process.env.ADVEGO_API_KEY
  if (!token) return res.status(500).json({ error: 'ADVEGO_API_KEY не задан' })
  if (!text)  return res.status(400).json({ error: 'text обязателен' })

  try {
    const r = await fetch('https://api.advego.com/json/antiplagiat/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'unique_text_add', id: 1,
        params: { token, text, ...(title ? { title: title.slice(0, 200) } : {}) },
      }),
    })
    const data = await r.json()
    if (data.error) return res.status(502).json({ error: `Advego: ${JSON.stringify(data.error)}` })
    const key = data.result?.key ?? data.result?.id
    if (!key) return res.status(502).json({ error: 'Advego: нет ключа в ответе', debug: data })
    res.json({ key: String(key) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
