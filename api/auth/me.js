const { requireAuth } = require('../_auth')
module.exports = (req, res) => {
  if (req.method !== 'GET') return res.status(405).end()
  const u = requireAuth(req, res)
  if (!u) return
  res.json({ username: u.sub })
}
