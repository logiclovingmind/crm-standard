function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

// Sets req.leadScope to the user id for agents (must filter every lead query),
// null for owner/manager (see everything).
function scopeLeadsToUser(req, res, next) {
  req.leadScope = req.session.user.role === 'agent' ? req.session.user.id : null;
  next();
}

module.exports = { requireAuth, requireRole, scopeLeadsToUser };
