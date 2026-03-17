// Simple RBAC middleware scaffold
module.exports = function rbac(requiredRoles = []) {
  return function (req, res, next) {
    // Read role from header for simplicity; real impl would use JWT/session
    const role = (req.headers['x-user-role'] || req.query.role || '').toString()
    if (!requiredRoles.length) {
      return next()
    }
    if (requiredRoles.includes(role)) {
      return next()
    }
    res.status(403).json({ code: 403, msg: 'Forbidden: insufficient permissions' })
  }
}
