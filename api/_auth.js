const crypto = require('crypto')
const SECRET  = process.env.JWT_SECRET || 'change-me'
const EXPIRES = 60 * 60 * 12

function b64(s) { return Buffer.from(s).toString('base64url') }

function createToken(username) {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + EXPIRES }))
  const s = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')
  return `${h}.${p}.${s}`
}

function verifyToken(token) {
  if (!token) throw new Error('No token')
  const [h, p, s] = token.split('.')
  if (!h || !p || !s) throw new Error('Malformed')
  const expected = crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')
  if (s !== expected) throw new Error('Invalid signature')
  const data = JSON.parse(Buffer.from(p, 'base64url').toString())
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Expired')
  return data
}

function requireAuth(req, res) {
  const header = req.headers['authorization'] || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  try { return verifyToken(token) }
  catch { res.status(401).json({ error: 'Необходима авторизация' }); return null }
}

module.exports = { createToken, verifyToken, requireAuth }
