# 🦅 Aquila Guardian

**Self-hosted duress alert system for crypto wallets.**

Monitors your wallet addresses 24/7 across 18 blockchain networks. If ANY outgoing transaction is detected — including one you were coerced into signing under duress — Aquila fires an immediate emergency alert to your pre-configured contacts via Telegram, SMS, and voice call.

Everything runs on **your own server** with **your own API keys**. There is no central service, no cloud, no account to create, no payment. Your data never leaves your machine.

---

## 🎯 What it does

1. **You configure** a list of wallet addresses to monitor (Bitcoin, Ethereum, Solana, Base, Polygon, Arbitrum, Optimism, Avalanche, BSC, and 9 more chains).
2. **You configure** emergency contacts — Telegram chat IDs, phone numbers for SMS, phone numbers for voice calls.
3. **Aquila polls** those wallets every 30 seconds via public RPC endpoints.
4. **When an outgoing transaction is detected** (nonce increases on EVM, mempool hit on Bitcoin, signature seen on Solana), Aquila:
   - Sends a Telegram message to every configured chat ID (free, unlimited).
   - Sends an SMS to every configured phone number via Twilio.
   - Makes a voice call to every voice contact and plays your pre-recorded emergency message.

The idea: even if an attacker forces you to sign a transaction, **your trusted contacts are notified in real time** and can act — freeze accounts, call law enforcement, reach out to custodians.

---

## 🏗 Architecture

Minimal on purpose. No database, no message queue, no external dependencies besides Express and dotenv.

```
┌─────────────────────────────────────────────────────┐
│  YOUR SERVER (VPS, home lab, Raspberry Pi, etc.)    │
│                                                      │
│  ┌──────────────────┐       ┌──────────────────┐    │
│  │ wallet-monitor   │──────▶│ alert-dispatcher │    │
│  │ (30s poll loop)  │       │                  │    │
│  └──────────────────┘       └──┬────────────┬──┘    │
│          ▲                     │            │       │
│          │                     ▼            ▼       │
│  ┌──────────────┐         Telegram API   Twilio API │
│  │ config.json  │                                   │
│  │ (encrypted)  │                                   │
│  └──────▲───────┘                                   │
│         │                                            │
│  ┌──────┴───────┐                                   │
│  │ /config.html │  ← you (via browser, password)    │
│  │ web UI       │                                   │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

- **`wallet-monitor`** — polls each watched wallet every 30 seconds via public RPCs.
- **`alert-dispatcher`** — shared dispatch path used both by the poll loop (automatic) and by the `/api/alert` endpoint (manual trigger).
- **`config-store`** — persists the entire operator state as one encrypted `data/config.json`. Contacts are AES-256-GCM encrypted at rest.
- **Web UI** — single-password login, then a config page where you manage contacts, wallets, custom messages, voice recording, and fire test alerts.

---

## 🚀 Quick start (Docker)

The fastest path. Assumes you have Docker + Docker Compose.

```bash
git clone https://github.com/YOUR-USERNAME/aquila-guardian.git
cd aquila-guardian
cp .env.example .env
# Edit .env and fill in ADMIN_PASSWORD, WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN,
# TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_VOICE_FROM, PUBLIC_HOST
docker compose up -d
```

Then open **http://localhost:3000** in your browser, sign in with your `ADMIN_PASSWORD`, and configure contacts, wallets, voice recording.

To check the logs:

```bash
docker compose logs -f aquila
```

To stop it:

```bash
docker compose down
```

---

## 🚀 Quick start (bare Node.js)

If you don't want Docker:

```bash
git clone https://github.com/YOUR-USERNAME/aquila-guardian.git
cd aquila-guardian
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

Server starts on `http://localhost:3000`. Same UI, same behavior.

---

## 🔧 Required configuration

You **must** set these in `.env` before starting:

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ always | Password for the web UI login |
| `WEBHOOK_SECRET` | ✅ always | AES-256 key for encrypting contacts on disk. Generate with `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | if using Telegram alerts | Your bot's token from @BotFather |
| `TWILIO_ACCOUNT_SID` | if using SMS/voice | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | if using SMS/voice | Twilio Auth Token |
| `TWILIO_SMS_FROM` | if using SMS | Twilio phone number in E.164 format (e.g. `+15551234567`) |
| `TWILIO_VOICE_FROM` | if using voice | Twilio phone number in E.164 format (can be the same as SMS) |
| `PUBLIC_HOST` | if using voice | Public HTTPS URL where `/voice.mp3` can be fetched by Twilio (e.g. `https://alerts.mydomain.tld`) |

All other env vars in `.env.example` are optional.

---

## 📱 Step-by-step: Configuring Telegram

1. Open Telegram and search for **@BotFather**.
2. Send `/newbot` and follow the prompts. Give your bot a name and a username ending in `bot` (e.g. `MyAquilaBot`).
3. BotFather will reply with a token like `123456789:AA...`. **Paste this into `TELEGRAM_BOT_TOKEN` in `.env`**.
4. Each emergency contact needs to:
   - Search for your new bot on Telegram.
   - Send any message to it (e.g. `/start`).
   - Find their own chat ID by messaging **@userinfobot** — it will reply with their numeric ID.
5. In the Aquila config UI (`/config.html`), add each chat ID under "Telegram Chat IDs".

That's it. Telegram alerts are free, unlimited, and typically arrive within 1–2 seconds.

---

## 📞 Step-by-step: Configuring Twilio (SMS + Voice)

Twilio handles real SMS and voice calls. It's pay-as-you-go — roughly $0.0075 per SMS and $0.014/min per voice call in the US (prices vary by destination country).

### 1. Create a Twilio account

1. Go to <https://www.twilio.com/try-twilio> and sign up.
2. Verify your email and your own phone number (they'll send you a verification code).
3. On first login you'll get **$15 of free trial credit**. Enough to test.

### 2. Get your Account SID and Auth Token

1. In the Twilio Console dashboard, the homepage shows your **Account SID** and **Auth Token** at the top right.
2. Copy both into `.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   ```

### 3. Buy a phone number

1. In the Twilio Console, go to **Phone Numbers → Manage → Buy a number**.
2. Pick your country and check the capabilities you need: **SMS** and **Voice** (✓ both).
3. Buy it — costs ~$1/month for a US number. Trial accounts can use the number immediately.
4. Copy the number in E.164 format (e.g. `+15551234567`) and paste into `.env`:
   ```
   TWILIO_SMS_FROM=+15551234567
   TWILIO_VOICE_FROM=+15551234567
   ```
   One number can handle both SMS and voice. Use different numbers if you want channel isolation.

### 4. Trial-account limitation

Twilio trial accounts can only send SMS and voice calls to **verified phone numbers**. Before you can alert grandma, you need to:

1. Go to **Phone Numbers → Manage → Verified Caller IDs**.
2. Click **Add a new Caller ID** and enter the phone number of each emergency contact.
3. Twilio will call or SMS them with a 6-digit code. They enter it in the console to verify.

Once you upgrade to a paid Twilio account (add a credit card, load credit), this restriction goes away and you can message any number.

### 5. Set `PUBLIC_HOST` for voice calls

Twilio's voice API needs to **fetch your recorded voice message** from a public HTTPS URL. Your local backend serves it at `/voice.mp3`, so Twilio needs to see that URL from the open internet.

Options:
- **Production**: point a subdomain at your server (e.g. `alerts.mydomain.tld`), put nginx/Caddy in front with HTTPS (Let's Encrypt), and set `PUBLIC_HOST=https://alerts.mydomain.tld`.
- **Testing**: use a tunnel like [ngrok](https://ngrok.com/) (`ngrok http 3000`) and set `PUBLIC_HOST` to the ngrok URL while it's running.

⚠️ If `PUBLIC_HOST` is empty or unreachable from Twilio, voice alerts will fail silently. SMS and Telegram still work.

---

## 🎙 Recording your voice message

1. Sign in to the config UI at `/config.html`.
2. Scroll to **Voice Recording**.
3. Click **Start recording**, grant microphone permission, speak your emergency message (keep it short — 10-20 seconds), click **Stop recording**.
4. Play it back to verify, then click **Upload**.
5. The file is saved to `server/data/voice.mp3` and served from `PUBLIC_HOST/voice.mp3` for Twilio to fetch.

> **Note on audio format**: browsers record in webm/opus by default. The file is uploaded as-is and Twilio generally handles it, but for best compatibility consider transcoding to mp3 with ffmpeg before upload. A future version may handle this server-side automatically.

---

## 💼 Adding watched wallets

In the config UI under **Watched Wallets**:

1. Paste the wallet address (e.g. `0x...` for EVM, `bc1q...` for Bitcoin, `Dn...` for Solana).
2. Pick the network from the dropdown.
3. Give it an optional label.
4. Click **Add wallet**.

Aquila will start polling it on the next 30-second cycle. The first poll seeds the state without alerting, so you don't get a false alarm from existing activity.

### Supported networks

**Layer 1**: Bitcoin, Ethereum, Solana, Tron
**Layer 2 / sidechains**: Base, Polygon, Arbitrum, Optimism, Avalanche, BSC, Fantom, Gnosis, zkSync Era, Linea, Scroll, Celo, Mantle, Blast

All checks use **free public RPC endpoints** — no API keys needed, no rate limit issues for the scale of personal use (a handful of wallets polled every 30s).

---

## 🚨 Firing a test alert

Always run a test alert right after initial setup, before trusting it for real.

1. In the config UI, scroll to **Test Alert**.
2. Click **Fire test alert now**.
3. Your Telegram, SMS, and voice contacts will receive a real alert with the text `TEST ALERT — ignore this message.`
4. Check the JSON response in the UI for per-channel success/failure.

If any channel fails, fix it before relying on Aquila.

---

## 🔐 Security model & threats

### What Aquila protects against
- **Silent theft**: attacker drains your wallet via a signed transaction. Aquila detects the outflow within ~30 seconds and alerts your contacts.
- **$5 wrench attack / duress**: attacker forces you to send a transaction. You send it, Aquila alerts independently, your contacts know something is wrong in real time.
- **Compromised hot wallet**: same as above — outflow detected, contacts alerted.

### What Aquila does NOT protect against
- **Front-running the alert**: Aquila polls every 30 seconds. A transaction confirmed and finalized faster than your contacts can react won't be prevented, only reported.
- **Adversary with root access to your Aquila server**: if they control the box running this, they can disable the monitor, wipe contacts, and delete the voice recording. Run Aquila on a separate machine from your daily driver.
- **Compromised Twilio/Telegram**: if an attacker controls your Telegram bot token or Twilio credentials, they can see your alert history. Rotate credentials on suspicion.
- **Contacts who don't pick up / act**: Aquila notifies. It's up to your contacts to react.

### Defensive practices

- Use a **long random `ADMIN_PASSWORD`** (32+ chars). This is the only thing between the public internet and your alert pipeline.
- Put the backend **behind HTTPS** (nginx + Let's Encrypt, Caddy, Cloudflare Tunnel). Never expose plain HTTP on port 3000 to the internet.
- Set a **firewall rule** allowing only your own IP (or your reverse proxy) to hit port 3000 directly.
- **Store `WEBHOOK_SECRET` out of version control**. If it leaks, rotate it and re-save your config (the old encrypted contacts become unreadable).
- Review your **contact list quarterly** — remove people who no longer should receive alerts.
- **Test monthly**. An alert pipeline that's never been tested is not an alert pipeline.

---

## 🗂 File layout

```
aquila-guardian/
├── server/
│   ├── index.js              # Express bootstrap + wallet monitor start
│   ├── middleware/
│   │   ├── auth.js           # Password-based session auth
│   │   └── security.js       # Headers + rate limiting
│   ├── routes/
│   │   ├── auth.js           # /api/auth/login, /logout, /session
│   │   ├── config.js         # /api/config GET+POST (single-tenant state)
│   │   ├── alert.js          # /api/alert (manual trigger)
│   │   ├── voice.js          # /api/voice/upload, /delete, /status
│   │   └── health.js         # /api/health
│   ├── services/
│   │   ├── config-store.js   # Persist data/config.json (encrypted contacts)
│   │   ├── wallet-monitor.js # 30s poll loop across 18 networks
│   │   ├── alert-dispatcher.js # Unified dispatch for telegram/sms/voice
│   │   ├── telegram.js       # Telegram Bot API wrapper
│   │   ├── twilio.js         # Twilio SMS + voice wrapper
│   │   └── encrypt.js        # AES-256-GCM helper
│   ├── public/
│   │   ├── index.html        # Redirect to login or config
│   │   ├── login.html        # Password entry
│   │   └── config.html       # Single-page config UI
│   └── data/                 # Runtime state (gitignored)
│       ├── config.json       # Encrypted operator state
│       ├── voice.mp3         # Uploaded voice recording
│       └── seen-txs.json     # Tx dedup state for the poll loop
├── .env.example              # Config template
├── Dockerfile
├── docker-compose.yml
├── LICENSE                   # MIT
├── package.json
└── README.md
```

---

## 🤝 Contributing

This is a personal-security tool, not a company's product. PRs welcome for:

- Additional blockchain network support
- Server-side webm → mp3 transcoding for the voice feature
- Alternative alert channels (Matrix, Signal via signal-cli, email via SMTP)
- Better testing harness
- Translations

Keep it minimal. The whole point of Aquila is that an operator can read every line of code in an afternoon and understand what happens to their data.

---

## ⚠️ Disclaimer

This software is provided **as is**, with no warranty. Crypto security is ultimately your responsibility. This tool is one layer of defense among many — it does not replace hardware wallets, cold storage, operational security, or common sense.

You are responsible for:
- Obtaining explicit consent from every person you add as an emergency contact.
- Complying with local laws about automated SMS/voice calls (TCPA in the US, GDPR in the EU, LGPD in Brazil, etc.).
- Keeping your server secure.
- Testing the alert pipeline before relying on it.

The authors accept no liability for missed alerts, false alarms, compromised credentials, or any loss of funds.

---

## 📜 License

[MIT](./LICENSE). Fork it, modify it, self-host it. Commercial use is allowed by the license but the spirit of this project is decentralization: **run your own, keep your own data**.

---

## 💝 Support the project

If Aquila Guardian helped you sleep better at night, you can send some crypto our way. **Zero expectation** — the project is free and the code is yours.

**USDC on Base Chain**:
```
0x5d0546AdA81227477B527779843f65B5BeF6223a
```

Thank you. 🦅
