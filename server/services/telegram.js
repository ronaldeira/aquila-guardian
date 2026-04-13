var BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
var API_URL = 'https://api.telegram.org/bot' + BOT_TOKEN;

async function sendMessage(chatId, text) {
  var response = await fetch(API_URL + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });

  if (!response.ok) {
    var body = await response.text();
    throw new Error('Telegram error ' + response.status + ': ' + body);
  }
  return response.json();
}

module.exports = { sendMessage };
