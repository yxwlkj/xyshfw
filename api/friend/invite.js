// Placeholder Invite API for /api/friend/invite
// Simple stub that acknowledges an invite request.
const express = require('express')
const router = express.Router()

router.post('/invite', (req, res) => {
  const { to, message } = req.body || {}
  // In a real implementation, you'd trigger a notification/invite flow.
  res.json({ code: 200, ok: true, to, message })
})

module.exports = () => router
