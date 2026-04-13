// voice.js — upload/delete the single voice recording used for Twilio voice calls.
// Single-tenant: one operator, one recording, stored at data/voice.mp3. Twilio fetches
// it via <Play> from PUBLIC_HOST/voice.mp3 during an alert.

var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var auth = require('../middleware/auth');

var VOICE_PATH = path.join(__dirname, '../data/voice.mp3');
var MAX_SIZE = 5 * 1024 * 1024; // 5 MB — plenty for a 30-second emergency message

// POST /api/voice/upload — receives raw MP3 bytes in the request body.
// The UI records via MediaRecorder, converts to mp3 client-side (or uploads webm
// and we rely on ffmpeg — see note in README for the webm→mp3 conversion step).
router.post('/voice/upload', auth.requireAuth, express.raw({ type: 'audio/*', limit: MAX_SIZE }), function(req, res) {
  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'Empty body — send the mp3 bytes as audio/mpeg' });
  }
  try {
    fs.mkdirSync(path.dirname(VOICE_PATH), { recursive: true });
    fs.writeFileSync(VOICE_PATH, req.body);
    res.json({ ok: true, size: req.body.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/voice', auth.requireAuth, function(req, res) {
  try {
    if (fs.existsSync(VOICE_PATH)) fs.unlinkSync(VOICE_PATH);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/voice/status — tiny helper for the UI to show "recording uploaded / none"
router.get('/voice/status', auth.requireAuth, function(req, res) {
  var exists = fs.existsSync(VOICE_PATH);
  var size = exists ? fs.statSync(VOICE_PATH).size : 0;
  res.json({ exists: exists, size: size });
});

module.exports = router;
