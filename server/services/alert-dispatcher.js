// alert-dispatcher.js — central alert dispatch used by both wallet-monitor (automatic)
// and routes/alert (manual trigger). Sends through every configured channel in parallel
// and collects per-channel results so the caller can see what succeeded and what failed.
//
// Channels:
//   - Telegram: free, unlimited, via Bot API
//   - SMS: Twilio, costs per message
//   - Voice: Twilio, costs per minute, REQUIRES a recorded voice file (no TTS fallback)

var fs = require('fs');
var path = require('path');
var telegram = require('./telegram');
var twilio = require('./twilio');

var VOICE_FILE = path.join(__dirname, '../data/voice.mp3');

function publicVoiceUrl() {
  // Twilio fetches <Play> URLs from the public internet, so this has to resolve
  // externally. Operators set PUBLIC_HOST in .env to e.g. https://alerts.mydomain.tld
  var host = process.env.PUBLIC_HOST || '';
  if (!host) return '';
  return host.replace(/\/$/, '') + '/voice.mp3';
}

async function dispatch(payload) {
  var results = [];

  var tgMessage = (payload.customMessages && payload.customMessages.telegram) || payload.defaultMessage;
  var smsMessage = (payload.customMessages && payload.customMessages.sms) || payload.defaultMessage;

  // Telegram — free, send first so even when Twilio fails the operator knows
  var tgContacts = payload.telegramContacts || [];
  for (var i = 0; i < tgContacts.length; i++) {
    var chatId = tgContacts[i];
    try {
      await telegram.sendMessage(chatId, tgMessage);
      results.push({ channel: 'telegram', to: chatId, sent: true });
    } catch (e) {
      results.push({ channel: 'telegram', to: chatId, sent: false, error: e.message });
    }
  }

  // SMS via Twilio
  var smsContacts = payload.smsContacts || [];
  for (var j = 0; j < smsContacts.length; j++) {
    var phone = smsContacts[j];
    try {
      await twilio.sendSMS(phone, smsMessage);
      results.push({ channel: 'sms', to: phone, sent: true });
    } catch (e) {
      results.push({ channel: 'sms', to: phone, sent: false, error: e.message });
    }
  }

  // Voice via Twilio — requires a recorded voice.mp3 served from PUBLIC_HOST
  var voiceContacts = payload.voiceContacts || [];
  if (voiceContacts.length > 0) {
    var voiceUrl = publicVoiceUrl();
    var hasRecording = fs.existsSync(VOICE_FILE);

    if (!voiceUrl) {
      for (var k = 0; k < voiceContacts.length; k++) {
        results.push({ channel: 'voice', to: voiceContacts[k], sent: false, error: 'PUBLIC_HOST not configured — Twilio needs an external URL to fetch the recording' });
      }
    } else if (!hasRecording) {
      for (var k2 = 0; k2 < voiceContacts.length; k2++) {
        results.push({ channel: 'voice', to: voiceContacts[k2], sent: false, error: 'No voice recording uploaded yet' });
      }
    } else {
      for (var m = 0; m < voiceContacts.length; m++) {
        var phoneV = voiceContacts[m];
        try {
          await twilio.makeVoiceCall(phoneV, voiceUrl);
          results.push({ channel: 'voice', to: phoneV, sent: true });
        } catch (e) {
          results.push({ channel: 'voice', to: phoneV, sent: false, error: e.message });
        }
      }
    }
  }

  var delivered = results.some(function(r) { return r.sent; });
  return { delivered: delivered, results: results };
}

module.exports = { dispatch: dispatch };
