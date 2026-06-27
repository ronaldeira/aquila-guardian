# Pods Workshop Wallet

A public workshop wallet that shows how to build a product-like Web3 wallet with Pods, Privy embedded wallets, and Privy smart wallets.

This app is intentionally focused on the wallet experience: balances, history, crypto deposit, crypto withdraw/send, swap, earn, activity logs, supported chains, language/currency preferences, and light theme styling. On-ramp/off-ramp is out of scope for this workshop repo.

## What You Build

- Privy authentication with embedded wallet creation.
- Privy Smart Wallet as the only displayed and executable wallet address.
- Pods wallet v2 balance and history reads from `/v2/wallets/:smartWalletAddress`.
- Crypto deposit flow that copies the smart wallet address.
- Crypto withdraw/send flow that executes from the smart wallet.
- Pods Swap and Earn widgets through `DeframeProvider`.
- Smart-wallet execution for Pods bytecode through `processBytecode`.
- Websocket configuration for realtime Pods updates.
- Supported-chain configuration across Base, Polygon, Arbitrum, Optimism, Ethereum, BNB Smart Chain, Gnosis, Avalanche, zkSync Era, Linea, Celo, HyperEVM, and Base Sepolia.
- Local workshop preferences for English/Portuguese and USD/BRL formatting.

## Prerequisites

- Node.js 20 or newer.
- pnpm 9 or newer.
- A Privy app with embedded wallets and smart wallets enabled.
- A Pods API key.
- A browser wallet is optional; the app flow is designed around Privy embedded wallet plus Privy Smart Wallet.

## Environment

Copy the example file and fill your local values:

```bash
cp .env.local.example .env.local
```

Required values:

```bash
NEXT_PUBLIC_PODS_URL=https://api.deframe.io
NEXT_PUBLIC_PODS_API_KEY=your_pods_api_key
NEXT_PUBLIC_PODS_WEBSOCKET_URL=wss://api.deframe.io/updates
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
```

Optional RPC overrides are already listed in `.env.local.example`. The public RPC defaults in the app are enough for local workshop exploration, but production apps should use dedicated RPC infrastructure.

Never put a Privy app secret in this frontend app. The Privy app secret belongs only on a trusted backend.

## Privy Dashboard Notes

In the Privy dashboard:

- Enable email login and embedded wallets.
- Enable Ethereum embedded wallets.
- Enable smart wallets for the chains used in the workshop.
- Add `http://127.0.0.1:5173` and any deployed URL to the allowed app origins.
- Keep the app secret out of this repository and out of browser code.

The app uses the embedded wallet as the owner and the Privy Smart Wallet as the account that Pods reads, displays, and executes from. The owner address is not shown as the deposit address.

## Pods Notes

Pods provides the product rails used here:

- Wallet v2 balances and history power the local dashboard and activity list.
- Swap and Earn are mounted as SDK widgets through `DeframeProvider`.
- Websocket updates can be configured with `NEXT_PUBLIC_PODS_WEBSOCKET_URL`.
- Transaction execution is delegated back to the host app through `processBytecode`, where the app sends batched calls with the Privy Smart Wallet client.

## Run Locally

```bash
pnpm install --ignore-scripts
npm run typecheck
npm run build
pnpm dev --host 127.0.0.1 --port 5173
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Smart-Wallet-Only Invariant

This workshop app must only display and use the Privy Smart Wallet address.

- Deposit copies the smart wallet address.
- Pods wallet v2 reads use the smart wallet address.
- Swap/Earn widgets receive the smart wallet address in `DeframeProvider`.
- Sends and Pods bytecode execution use Privy smart wallet clients.
- There is no legacy smart-account fallback, no deterministic salt, and no alternate wallet-address logic in this app.

## Preferences

The Activity tab includes workshop settings:

- Language: `EN` or `PT`.
- Currency: `USD` or `BRL`.
- USD/BRL rate: manual input, default `5.5`, used when BRL is selected.

Preferences are stored in `localStorage` and fed into both local formatting and `DeframeProvider`.

## Security

- `.env.local` is ignored and must stay local.
- `.env.local.example` contains placeholders only.
- `node_modules` and `dist` are ignored.
- Do not commit API keys, Privy app secrets, bearer tokens, private keys, wallet recovery phrases, or local production RPC credentials.
- This is workshop code, not an audited production wallet.

## AI Rebuild Playbook

See [`AI_REBUILD_WORKSHOP_WALLET.md`](./AI_REBUILD_WORKSHOP_WALLET.md) for a self-contained AI-readable build playbook. It includes the project structure, dependency versions, environment schema, source bundle, validation commands, and the design/integration rules needed to recreate this wallet from scratch.

## License

Apache-2.0.
