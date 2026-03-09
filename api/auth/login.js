const { createToken } = require('../_auth')

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.json({ configured: !!process.env.ADMIN_PASSWORD })
  }
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password } = req.body || {}
  const eu = process.env.ADMIN_USERNAME || 'admin'
  const ep = process.env.ADMIN_PASSWORD || ''

  if (!ep) return res.status(400).json({ error: 'ADMIN_PASSWORD не задан в переменных Vercel' })
  if (username !== eu || password !== ep)
    return res.status(401).json({ error: 'Неверное имя пользователя или пароль' })

  const token = createToken(username)
  res.json({ access_token: token, username, token_type: 'bearer' })
}
