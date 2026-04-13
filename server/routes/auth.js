var express = require('express');
var router = express.Router();
var auth = require('../middleware/auth');

// POST /api/auth/login — trades the admin password for a session cookie.
router.post('/auth/login', function(req, res) {
  var password = (req.body && req.body.password) || '';
  if (!auth.checkPassword(password)) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  var token = auth.createSession();
  res.setHeader('Set-Cookie', 'aquila_session=' + token + '; HttpOnly; Path=/; SameSite=Strict; Max-Age=604800');
  res.json({ ok: true, token: token });
});

router.post('/auth/logout', function(req, res) {
  var token = auth.extractToken(req);
  auth.destroySession(token);
  res.setHeader('Set-Cookie', 'aquila_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
  res.json({ ok: true });
});

// GET /api/auth/session — used by the web UI on page load to decide whether
// to show the login form or the config dashboard.
router.get('/auth/session', function(req, res) {
  res.json({ authenticated: auth.isAuthenticated(req) });
});

module.exports = router;
