// alert.js — manual trigger endpoint for firing an alert on demand, e.g. from
// a test button in the config UI or from an external webhook.
// Requires auth; reads contacts + custom messages from the stored config.

var express = require('express');
var router = express.Router();
var auth = require('../middleware/auth');
var store = require('../services/config-store');
var dispatcher = require('../services/alert-dispatcher');

// POST /api/alert — fires an alert to all configured contacts.
// Optional body: { message: "custom override message" }
router.post('/alert', auth.requireAuth, async function(req, res) {
  var config = store.load();
  if (!config.consentAccepted) {
    return res.status(400).json({
      error: 'Consent disclaimer not accepted. Accept it in the config UI before firing alerts.'
    });
  }

  var override = req.body && req.body.message;
  var defaultMessage = override || 'ALERT: Emergency alert triggered manually via Aquila Guardian.';

  try {
    var result = await dispatcher.dispatch({
      telegramContacts: config.contacts.telegram,
      smsContacts: config.contacts.sms,
      voiceContacts: config.contacts.voice,
      customMessages: config.customMessages,
      defaultMessage: defaultMessage,
      source: 'manual',
      timestamp: new Date().toISOString()
    });
    res.json({ ok: true, delivered: result.delivered, results: result.results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
