require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
var express = require('express');
var path = require('path');
var fs = require('fs');

var security = require('./middleware/security');
var healthRoutes = require('./routes/health');
var authRoutes = require('./routes/auth');
var configRoutes = require('./routes/config');
var alertRoutes = require('./routes/alert');
var voiceRoutes = require('./routes/voice');

var app = express();
app.set('trust proxy', 1);
var PORT = parseInt(process.env.PORT || '3000', 10);

if (!process.env.ADMIN_PASSWORD) {
  console.error('[STARTUP] ABORT: ADMIN_PASSWORD not set in .env. Refusing to start — ' +
    'the web UI would be accessible with no password.');
  process.exit(1);
}

app.use(security.securityHeaders);
app.use(security.globalLimiter);
app.use(express.json({ limit: '256kb' }));

app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', configRoutes);
app.use('/api', alertRoutes);
app.use('/api', voiceRoutes);

// Public voice file — Twilio fetches this during voice calls. Served without auth
// on purpose: Twilio has no way to send our session cookie.
app.get('/voice.mp3', function(req, res) {
  var voicePath = path.join(__dirname, 'data/voice.mp3');
  if (!fs.existsSync(voicePath)) {
    return res.status(404).send('No voice recording');
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.sendFile(voicePath);
});

// Static web UI — /login.html and /config.html
app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  app.listen(PORT, function() {
    console.log('Aquila Guardian running on port ' + PORT);
    var monitor = require('./services/wallet-monitor');
    monitor.start();
  });
}

module.exports = app;
