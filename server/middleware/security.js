// security.js — baseline security headers + per-IP rate limiting.
// Minimal on purpose: this backend is single-tenant self-host, so the operator
// sits behind their own reverse proxy / firewall — we don't need fancy CORS
// origin lists or Twilio webhook signature verification here.

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  next();
}

// Simple in-memory token bucket per IP. Resets every minute.
var buckets = new Map();
var GLOBAL_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '120', 10);
var WINDOW_MS = 60 * 1000;

function globalLimiter(req, res, next) {
  var ip = req.ip || req.connection.remoteAddress || 'unknown';
  var now = Date.now();
  var bucket = buckets.get(ip);

  if (!bucket || now - bucket.start > WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return next();
  }
  bucket.count++;
  if (bucket.count > GLOBAL_LIMIT) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
}

// Periodically prune expired buckets so the Map doesn't grow forever
setInterval(function() {
  var now = Date.now();
  for (var entry of buckets.entries()) {
    if (now - entry[1].start > WINDOW_MS * 2) buckets.delete(entry[0]);
  }
}, WINDOW_MS).unref();

module.exports = {
  securityHeaders: securityHeaders,
  globalLimiter: globalLimiter
};
