// twilio.js — SMS and Voice alerts via Twilio.
// WhatsApp removed: Meta permanently bans crypto-related bots on Business Platform.

var TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
var TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
var TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM || '';
var TWILIO_VOICE_FROM = process.env.TWILIO_VOICE_FROM || '';

var TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts/' + TWILIO_SID;

function twilioFetch(endpoint, params) {
  var body = new URLSearchParams(params).toString();
  var auth = Buffer.from(TWILIO_SID + ':' + TWILIO_TOKEN).toString('base64');

  return fetch(TWILIO_API + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + auth
    },
    body: body
  }).then(function(res) {
    return res.json().then(function(data) {
      if (res.ok) return data;
      throw new Error('Twilio ' + res.status + ': ' + (data.message || JSON.stringify(data)));
    });
  });
}

async function sendSMS(phoneNumber, text) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_SMS_FROM) {
    throw new Error('Twilio SMS not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM)');
  }
  return twilioFetch('/Messages.json', {
    To: phoneNumber,
    From: TWILIO_SMS_FROM,
    Body: text
  });
}

async function makeVoiceCall(phoneNumber, voiceAudioUrl) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_VOICE_FROM) {
    throw new Error('Twilio Voice not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VOICE_FROM)');
  }
  if (!voiceAudioUrl) {
    throw new Error('Voice calls require a custom recording — no TTS fallback');
  }

  // Play the recording twice with a short pause, so the contact has time to
  // process what they're hearing even if they picked up mid-message.
  var twiml = '<Response><Play>' + escapeXml(voiceAudioUrl) + '</Play><Pause length="2"/><Play>' + escapeXml(voiceAudioUrl) + '</Play></Response>';

  return twilioFetch('/Calls.json', {
    To: phoneNumber,
    From: TWILIO_VOICE_FROM,
    Twiml: twiml
  });
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { sendSMS: sendSMS, makeVoiceCall: makeVoiceCall };
