// Minimal Web Share API helper with QR fallback hook
function shareContent({ title, text, url } = {}) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    return navigator.share({ title, text, url }).catch(() => false)
  }
  // Fallback: return false to indicate QR code or manual share should be used
  return Promise.resolve(false)
}

module.exports = { shareContent }
