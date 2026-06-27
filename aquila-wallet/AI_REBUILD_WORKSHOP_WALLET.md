# AI Rebuild Playbook: Pods Workshop Wallet

This document is a self-contained build guide for recreating the public Pods Workshop Wallet from scratch. It is written for AI coding agents and workshop participants who need deterministic instructions, clear product intent, and source-level implementation details.

The target result is a Vite + React app that demonstrates a real Pods + Privy wallet flow: wallet v2 balances/history, crypto deposit, crypto withdraw/send, Swap, Earn, activity logs, supported chains, light theme styling, and persisted workshop preferences for language and currency. On/off-ramp is intentionally out of scope.

## Product Goal

Build a product-like Web3 wallet workshop app where users authenticate with Privy, receive an embedded wallet owner, and interact only through a Privy Smart Wallet account. Pods powers the wallet data, Swap/Earn widgets, websocket configuration, and transaction bytecode flow. The app should feel like a working wallet demo, not a static mock.

## Non-Negotiable Invariants

- Display and use only the Privy Smart Wallet address.
- Never display the embedded owner wallet as the deposit or account address.
- Never use a legacy smart-account fallback, deterministic salt, or alternate wallet-address logic.
- Never put a Privy app secret in frontend code or documentation.
- Never commit `.env.local`, `node_modules`, or `dist`.
- Keep on/off-ramp outside this repo.

## Recommended Build Steps

1. Create a new Vite React TypeScript project named `pods-workshop-wallet`.
2. Replace the generated files with the source bundle at the end of this document.
3. Install dependencies with `pnpm install --ignore-scripts`.
4. Copy `.env.local.example` to `.env.local` and fill local credentials.
5. Run `npm run typecheck` and `npm run build`.
6. Run `pnpm dev --host 127.0.0.1 --port 5173` and open `http://127.0.0.1:5173`.

## Dependency Versions

Use the exact dependency ranges from `package.json` below.

| Package | Version |
| --- | --- |
| `@deframe-sdk/components` | `0.1.91` |
| `@privy-io/react-auth` | `2.25.0` |
| `@reduxjs/toolkit` | `^2.12.0` |
| `@types/react` | `^19.2.17` |
| `@types/react-dom` | `^19.2.3` |
| `@vitejs/plugin-react` | `^6.0.3` |
| `buffer` | `^6.0.3` |
| `lucide-react` | `^1.21.0` |
| `permissionless` | `0.2.57` |
| `pods-sdk` | `0.2.83` |
| `react` | `19.2.7` |
| `react-dom` | `19.2.7` |
| `react-redux` | `^9.3.0` |
| `redux` | `^5.0.1` |
| `typescript` | `~6.0.2` |
| `viem` | `2.37.7` |
| `vite` | `^8.1.0` |

## Environment Schema

The public repository must include only placeholders in `.env.local.example`.

Required:

- `NEXT_PUBLIC_PODS_URL`: Pods/Deframe API base URL, normally `https://api.deframe.io`.
- `NEXT_PUBLIC_PODS_API_KEY`: public workshop API key provided to the participant.
- `NEXT_PUBLIC_PODS_WEBSOCKET_URL`: Pods websocket URL for realtime updates.
- `NEXT_PUBLIC_PRIVY_APP_ID`: Privy app id.

Optional RPC overrides:

- `NEXT_PUBLIC_BASE_RPC_URL`
- `NEXT_PUBLIC_POLYGON_RPC_URL`
- `NEXT_PUBLIC_ARBITRUM_RPC_URL`
- `NEXT_PUBLIC_OPTIMISM_RPC_URL`
- `NEXT_PUBLIC_ETHEREUM_RPC_URL`
- `NEXT_PUBLIC_BSC_RPC_URL`
- `NEXT_PUBLIC_GNOSIS_RPC_URL`
- `NEXT_PUBLIC_AVALANCHE_RPC_URL`
- `NEXT_PUBLIC_ZKSYNC_RPC_URL`
- `NEXT_PUBLIC_LINEA_RPC_URL`
- `NEXT_PUBLIC_CELO_RPC_URL`
- `NEXT_PUBLIC_HYPEREVM_RPC_URL`
- `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`

## Privy Configuration

In the Privy dashboard, enable email login, embedded wallets, and smart wallets for the workshop chains. Add `http://127.0.0.1:5173` as an allowed origin. The app secret must stay on a backend and is not needed for this frontend workshop.

The React app config uses `PrivyProvider` and `SmartWalletsProvider`. The embedded wallet is treated as the owner. The smart wallet client address is normalized and used as `walletAddressForPods`. All deposit, balance, history, Swap, Earn, and send flows use that smart wallet address.

## Pods Integration

Pods is the main product integration in this workshop:

- Wallet v2 balances/history are fetched from `/v2/wallets/:smartWalletAddress` and used by the dashboard, asset rows, transfer pickers, and activity history.
- `DeframeProvider` receives the Pods API URL, Pods API key, websocket URL, smart wallet address, user id, supported chains, theme, language, currency, exchange rate, and behavior config.
- `SwapWidget` and `EarnWidget` provide production-like swap and earn experiences with Pods UI components.
- `processBytecode` is the host execution bridge. Pods returns bytecode/calls, the app checks the requested chain, obtains the Privy smart wallet client for that chain, sends batched calls, and reports lifecycle events back to Pods.
- Realtime updates are enabled by passing `NEXT_PUBLIC_PODS_WEBSOCKET_URL` to the Deframe config.

## Supported Chains

The app supports Base, Polygon, Arbitrum, Optimism, Ethereum mainnet, BNB Smart Chain, Gnosis, Avalanche, zkSync Era, Linea, Celo, HyperEVM, and Base Sepolia. The chains are configured both for Privy and for Pods/Deframe, with sensible public RPC defaults and environment override support.

## UI And Styling Guidance

The wallet is a light mobile-style dashboard with a 650px shell width, compact icon navigation, blue-violet accent color, and dense product surfaces. Keep it bright, simple, and product-like for projector readability. Avoid mock-only data: render real Pods wallet v2 balances/history when the user connects and deposits funds.

The app includes preference controls in the Activity tab:

- Language: `EN` or `PT`.
- Currency: `USD` or `BRL`.
- Manual USD-to-BRL rate, default `5.5`, shown when BRL is selected.

These preferences are persisted in `localStorage` and passed into `DeframeProvider` as `language`, `globalCurrency`, and `globalCurrencyExchangeRate`. Local dashboard, asset, and transfer formatting uses the same preference object.

## Validation Commands

Run these after creating the files:

```bash
pnpm install --ignore-scripts
npm run typecheck
npm run build
pnpm dev --host 127.0.0.1 --port 5173
```

Browser smoke test checklist:

- Overview renders with `My Wallet`, connect/disconnect button, smart wallet copy chip, and asset list or empty state.
- Deposit tab renders a smart wallet deposit address after connection.
- Send tab renders transfer controls when balances exist.
- Swap tab mounts Pods Swap widget.
- Earn tab mounts Pods Earn widget.
- Activity tab renders wallet history, workshop event logs, language selector, currency selector, and BRL exchange-rate input when BRL is selected.
- No legacy wallet address, legacy env var, or alternate wallet status appears anywhere.

## Publication Audit

Before committing or publishing:

```bash
git status --short
git ls-files
rg -n "privy_app_secret|bearer|private key|mnemonic|seed phrase|api_key=|secret=|token=" . --glob '!node_modules/**' --glob '!dist/**' --glob '!pnpm-lock.yaml'
```

The secret scan command above is intentionally targeted at common leak shapes from local workshop development. It should produce no output in the public repo.

## Source Bundle

Create each file below with exactly the provided content. Do not create `.env.local` from this bundle; create it locally from `.env.local.example` and keep it untracked.

<!-- file: .gitignore -->
````text
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
.env
.env.*
!.env.local.example
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
````

<!-- file: .env.local.example -->
````text
NEXT_PUBLIC_PODS_URL=https://api.deframe.io
NEXT_PUBLIC_PODS_API_KEY=your_pods_api_key
NEXT_PUBLIC_PODS_WEBSOCKET_URL=wss://api.deframe.io/updates
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_BASE_RPC_URL=https://base-rpc.publicnode.com
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-bor-rpc.publicnode.com
NEXT_PUBLIC_ARBITRUM_RPC_URL=https://arbitrum-one-rpc.publicnode.com
NEXT_PUBLIC_OPTIMISM_RPC_URL=https://optimism-rpc.publicnode.com
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://ethereum-rpc.publicnode.com
NEXT_PUBLIC_BSC_RPC_URL=https://bsc-rpc.publicnode.com
NEXT_PUBLIC_GNOSIS_RPC_URL=https://gnosis-rpc.publicnode.com
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
NEXT_PUBLIC_ZKSYNC_RPC_URL=https://mainnet.era.zksync.io
NEXT_PUBLIC_LINEA_RPC_URL=https://rpc.linea.build
NEXT_PUBLIC_CELO_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_HYPEREVM_RPC_URL=https://rpc.hyperliquid.xyz/evm
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com
````

<!-- file: package.json -->
````json
{
  "name": "pods-workshop-wallet",
  "private": true,
  "version": "0.0.0",
  "description": "Public Pods workshop wallet built with Privy smart wallets and Pods SDK.",
  "license": "Apache-2.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "typescript": "~6.0.2",
    "vite": "^8.1.0"
  },
  "dependencies": {
    "@deframe-sdk/components": "0.1.91",
    "@privy-io/react-auth": "2.25.0",
    "@reduxjs/toolkit": "^2.12.0",
    "buffer": "^6.0.3",
    "lucide-react": "^1.21.0",
    "permissionless": "0.2.57",
    "pods-sdk": "0.2.83",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "react-redux": "^9.3.0",
    "redux": "^5.0.1",
    "viem": "2.37.7"
  }
}
````

<!-- file: pnpm-workspace.yaml -->
````yaml
allowBuilds:
  '@reown/appkit': false
  bufferutil: false
  pods-sdk: false
  utf-8-validate: false
minimumReleaseAgeExclude:
  - pods-sdk@0.2.83
  - '@deframe-sdk/components@0.1.91'
overrides:
  framer-motion: 12.23.25
  motion-dom: 12.23.23
  motion-utils: 12.23.6
````

<!-- file: tsconfig.json -->
````json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "esnext",
    "lib": ["ES2023", "DOM"],
    "types": ["vite/client"],
    "jsx": "react-jsx",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
````

<!-- file: vite.config.ts -->
````ts
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      buffer: path.resolve(__dirname, 'node_modules/buffer'),
      'next/link': path.resolve(__dirname, 'src/shims/next-link.tsx'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
    },
  },
})
````

<!-- file: index.html -->
````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pods Workshop Wallet</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

<!-- file: public/favicon.svg -->
````xml
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="46" fill="none" viewBox="0 0 48 46"><path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z" style="fill:#863bff;fill:color(display-p3 .5252 .23 1);fill-opacity:1"/><mask id="a" width="48" height="46" x="0" y="0" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path fill="#000" d="M25.842 44.938c-.664.844-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.183c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.498 0-3.579-1.842-3.579H1.133c-.92 0-1.456-1.04-.92-1.787L9.91.473c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.578 1.842 3.578h11.377c.943 0 1.473 1.088.89 1.832L25.843 44.94z" style="fill:#000;fill-opacity:1"/></mask><g mask="url(#a)"><g filter="url(#b)"><ellipse cx="5.508" cy="14.704" fill="#ede6ff" rx="5.508" ry="14.704" style="fill:#ede6ff;fill:color(display-p3 .9275 .9033 1);fill-opacity:1" transform="matrix(.00324 1 1 -.00324 -4.47 31.516)"/></g><g filter="url(#c)"><ellipse cx="10.399" cy="29.851" fill="#ede6ff" rx="10.399" ry="29.851" style="fill:#ede6ff;fill:color(display-p3 .9275 .9033 1);fill-opacity:1" transform="matrix(.00324 1 1 -.00324 -39.328 7.883)"/></g><g filter="url(#d)"><ellipse cx="5.508" cy="30.487" fill="#7e14ff" rx="5.508" ry="30.487" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(89.814 -25.913 -14.639)scale(1 -1)"/></g><g filter="url(#e)"><ellipse cx="5.508" cy="30.599" fill="#7e14ff" rx="5.508" ry="30.599" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(89.814 -32.644 -3.334)scale(1 -1)"/></g><g filter="url(#f)"><ellipse cx="5.508" cy="30.599" fill="#7e14ff" rx="5.508" ry="30.599" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="matrix(.00324 1 1 -.00324 -34.34 30.47)"/></g><g filter="url(#g)"><ellipse cx="14.072" cy="22.078" fill="#ede6ff" rx="14.072" ry="22.078" style="fill:#ede6ff;fill:color(display-p3 .9275 .9033 1);fill-opacity:1" transform="rotate(93.35 24.506 48.493)scale(-1 1)"/></g><g filter="url(#h)"><ellipse cx="3.47" cy="21.501" fill="#7e14ff" rx="3.47" ry="21.501" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(89.009 28.708 47.59)scale(-1 1)"/></g><g filter="url(#i)"><ellipse cx="3.47" cy="21.501" fill="#7e14ff" rx="3.47" ry="21.501" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(89.009 28.708 47.59)scale(-1 1)"/></g><g filter="url(#j)"><ellipse cx=".387" cy="8.972" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(39.51 .387 8.972)"/></g><g filter="url(#k)"><ellipse cx="47.523" cy="-6.092" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(37.892 47.523 -6.092)"/></g><g filter="url(#l)"><ellipse cx="41.412" cy="6.333" fill="#47bfff" rx="5.971" ry="9.665" style="fill:#47bfff;fill:color(display-p3 .2799 .748 1);fill-opacity:1" transform="rotate(37.892 41.412 6.333)"/></g><g filter="url(#m)"><ellipse cx="-1.879" cy="38.332" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(37.892 -1.88 38.332)"/></g><g filter="url(#n)"><ellipse cx="-1.879" cy="38.332" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(37.892 -1.88 38.332)"/></g><g filter="url(#o)"><ellipse cx="35.651" cy="29.907" fill="#7e14ff" rx="4.407" ry="29.108" style="fill:#7e14ff;fill:color(display-p3 .4922 .0767 1);fill-opacity:1" transform="rotate(37.892 35.651 29.907)"/></g><g filter="url(#p)"><ellipse cx="38.418" cy="32.4" fill="#47bfff" rx="5.971" ry="15.297" style="fill:#47bfff;fill:color(display-p3 .2799 .748 1);fill-opacity:1" transform="rotate(37.892 38.418 32.4)"/></g></g><defs><filter id="b" width="60.045" height="41.654" x="-19.77" y="16.149" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/></filter><filter id="c" width="90.34" height="51.437" x="-54.613" y="-7.533" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/></filter><filter id="d" width="79.355" height="29.4" x="-49.64" y="2.03" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="e" width="79.579" height="29.4" x="-45.045" y="20.029" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="f" width="79.579" height="29.4" x="-43.513" y="21.178" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="g" width="74.749" height="58.852" x="15.756" y="-17.901" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="7.659"/></filter><filter id="h" width="61.377" height="25.362" x="23.548" y="2.284" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="i" width="61.377" height="25.362" x="23.548" y="2.284" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="j" width="56.045" height="63.649" x="-27.636" y="-22.853" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="k" width="54.814" height="64.646" x="20.116" y="-38.415" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="l" width="33.541" height="35.313" x="24.641" y="-11.323" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="m" width="54.814" height="64.646" x="-29.286" y="6.009" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="n" width="54.814" height="64.646" x="-29.286" y="6.009" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="o" width="54.814" height="64.646" x="8.244" y="-2.416" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter><filter id="p" width="39.409" height="43.623" x="18.713" y="10.588" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17158" stdDeviation="4.596"/></filter></defs></svg>
````

<!-- file: public/icons.svg -->
````xml
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="bluesky-icon" viewBox="0 0 16 17">
    <g clip-path="url(#bluesky-clip)"><path fill="#08060d" d="M7.75 7.735c-.693-1.348-2.58-3.86-4.334-5.097-1.68-1.187-2.32-.981-2.74-.79C.188 2.065.1 2.812.1 3.251s.241 3.602.398 4.13c.52 1.744 2.367 2.333 4.07 2.145-2.495.37-4.71 1.278-1.805 4.512 3.196 3.309 4.38-.71 4.987-2.746.608 2.036 1.307 5.91 4.93 2.746 2.72-2.746.747-4.143-1.747-4.512 1.702.189 3.55-.4 4.07-2.145.156-.528.397-3.691.397-4.13s-.088-1.186-.575-1.406c-.42-.19-1.06-.395-2.741.79-1.755 1.24-3.64 3.752-4.334 5.099"/></g>
    <defs><clipPath id="bluesky-clip"><path fill="#fff" d="M.1.85h15.3v15.3H.1z"/></clipPath></defs>
  </symbol>
  <symbol id="discord-icon" viewBox="0 0 20 19">
    <path fill="#08060d" d="M16.224 3.768a14.5 14.5 0 0 0-3.67-1.153c-.158.286-.343.67-.47.976a13.5 13.5 0 0 0-4.067 0c-.128-.306-.317-.69-.476-.976A14.4 14.4 0 0 0 3.868 3.77C1.546 7.28.916 10.703 1.231 14.077a14.7 14.7 0 0 0 4.5 2.306q.545-.748.965-1.587a9.5 9.5 0 0 1-1.518-.74q.191-.14.372-.293c2.927 1.369 6.107 1.369 8.999 0q.183.152.372.294-.723.437-1.52.74.418.838.963 1.588a14.6 14.6 0 0 0 4.504-2.308c.37-3.911-.63-7.302-2.644-10.309m-9.13 8.234c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.894 0 1.614.82 1.599 1.82.001 1-.705 1.82-1.6 1.82m5.91 0c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.893 0 1.614.82 1.599 1.82 0 1-.706 1.82-1.6 1.82"/>
  </symbol>
  <symbol id="documentation-icon" viewBox="0 0 21 20">
    <path fill="none" stroke="#aa3bff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" d="m15.5 13.333 1.533 1.322c.645.555.967.833.967 1.178s-.322.623-.967 1.179L15.5 18.333m-3.333-5-1.534 1.322c-.644.555-.966.833-.966 1.178s.322.623.966 1.179l1.534 1.321"/>
    <path fill="none" stroke="#aa3bff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" d="M17.167 10.836v-4.32c0-1.41 0-2.117-.224-2.68-.359-.906-1.118-1.621-2.08-1.96-.599-.21-1.349-.21-2.848-.21-2.623 0-3.935 0-4.983.369-1.684.591-3.013 1.842-3.641 3.428C3 6.449 3 7.684 3 10.154v2.122c0 2.558 0 3.838.706 4.726q.306.383.713.671c.76.536 1.79.64 3.581.66"/>
    <path fill="none" stroke="#aa3bff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" d="M3 10a2.78 2.78 0 0 1 2.778-2.778c.555 0 1.209.097 1.748-.047.48-.129.854-.503.982-.982.145-.54.048-1.194.048-1.749a2.78 2.78 0 0 1 2.777-2.777"/>
  </symbol>
  <symbol id="github-icon" viewBox="0 0 19 19">
    <path fill="#08060d" fill-rule="evenodd" d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844" clip-rule="evenodd"/>
  </symbol>
  <symbol id="social-icon" viewBox="0 0 20 20">
    <path fill="none" stroke="#aa3bff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" d="M12.5 6.667a4.167 4.167 0 1 0-8.334 0 4.167 4.167 0 0 0 8.334 0"/>
    <path fill="none" stroke="#aa3bff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35" d="M2.5 16.667a5.833 5.833 0 0 1 8.75-5.053m3.837.474.513 1.035c.07.144.257.282.414.309l.93.155c.596.1.736.536.307.965l-.723.73a.64.64 0 0 0-.152.531l.207.903c.164.715-.213.991-.84.618l-.872-.52a.63.63 0 0 0-.577 0l-.872.52c-.624.373-1.003.094-.84-.618l.207-.903a.64.64 0 0 0-.152-.532l-.723-.729c-.426-.43-.289-.864.306-.964l.93-.156a.64.64 0 0 0 .412-.31l.513-1.034c.28-.562.735-.562 1.012 0"/>
  </symbol>
  <symbol id="x-icon" viewBox="0 0 19 19">
    <path fill="#08060d" fill-rule="evenodd" d="M1.893 1.98c.052.072 1.245 1.769 2.653 3.77l2.892 4.114c.183.261.333.48.333.486s-.068.089-.152.183l-.522.593-.765.867-3.597 4.087c-.375.426-.734.834-.798.905a1 1 0 0 0-.118.148c0 .01.236.017.664.017h.663l.729-.83c.4-.457.796-.906.879-.999a692 692 0 0 0 1.794-2.038c.034-.037.301-.34.594-.675l.551-.624.345-.392a7 7 0 0 1 .34-.374c.006 0 .93 1.306 2.052 2.903l2.084 2.965.045.063h2.275c1.87 0 2.273-.003 2.266-.021-.008-.02-1.098-1.572-3.894-5.547-2.013-2.862-2.28-3.246-2.273-3.266.008-.019.282-.332 2.085-2.38l2-2.274 1.567-1.782c.022-.028-.016-.03-.65-.03h-.674l-.3.342a871 871 0 0 1-1.782 2.025c-.067.075-.405.458-.75.852a100 100 0 0 1-.803.91c-.148.172-.299.344-.99 1.127-.304.343-.32.358-.345.327-.015-.019-.904-1.282-1.976-2.808L6.365 1.85H1.8zm1.782.91 8.078 11.294c.772 1.08 1.413 1.973 1.425 1.984.016.017.241.02 1.05.017l1.03-.004-2.694-3.766L7.796 5.75 5.722 2.852l-1.039-.004-1.039-.004z" clip-rule="evenodd"/>
  </symbol>
</svg>
````

<!-- file: src/main.tsx -->
````tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import App from './App'
import '@deframe-sdk/components/styles.css'
import './style.css'

const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer }
globalWithBuffer.Buffer ??= Buffer

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
````

<!-- file: src/App.tsx -->
````tsx
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DashboardCard,
  PodsSwapFormView,
  WalletTransferAssetNetworkPicker,
  WalletOnchainDepositView,
  WalletOnchainWithdrawView,
  type BalanceDomain,
  type DashboardTokenItem,
  type NetworkOption,
  type TokenData,
  type WalletOnchainWithdrawDetails,
  type WalletTransferPickerStatus,
  type WalletTransferSelectedNetwork,
  type WalletTransferSelectedToken,
} from '@deframe-sdk/components'
import {
  addRpcUrlOverrideToChain,
  getEmbeddedConnectedWallet,
  PrivyProvider,
  useCreateWallet,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth'
import { SmartWalletsProvider, useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import {
  Activity,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  BadgeDollarSign,
  ChevronDown,
  Copy,
  EyeOff,
  Grid2X2,
  History,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import {
  DeframeProvider,
  EarnWidget,
  SwapWidget,
  type DeframeBehaviorConfig,
  type DeframeChainInput,
  type DeframeConfig,
  type DeframeProviderProps,
  type TxUpdateEvent,
} from 'pods-sdk'
import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  http,
  isAddress,
  parseUnits,
} from 'viem'
import { arbitrum, avalanche, base, baseSepolia, bsc, celo, gnosis, linea, mainnet, optimism, polygon, zkSync } from 'viem/chains'
import type { Address, Chain, Hex } from 'viem'

type AppTab = 'overview' | 'receive' | 'send' | 'swap' | 'earn' | 'activity'
type ProcessBytecode = NonNullable<DeframeProviderProps['processBytecode']>
type WalletDataStatus = 'idle' | 'loading' | 'ready' | 'error'
type WorkshopLanguage = 'EN' | 'PT'
type WorkshopCurrency = 'USD' | 'BRL'

type WorkshopPreferences = {
  language: WorkshopLanguage
  currency: WorkshopCurrency
  usdToBrlRate: number
}

type PodsApiToken = {
  id?: string
  address?: string
  chainId?: number
  name?: string
  symbol?: string
  decimals?: number
  logoURI?: string | null
  logoUrl?: string | null
  amountInUSD?: string | number
  humanized?: string
  amountHumanized?: string
  amountUI?: string
  price?: string | number
  priceUSD?: string | number
  amountBase?: string | number
}

type PodsBalanceSection = {
  positions?: PodsApiToken[]
  summary?: {
    totalAmountInUSD?: string | number
  }
}

type PodsEarnPosition = {
  strategy?: {
    id?: string
    assetName?: string
    protocol?: string
    networkId?: number
    logoUrl?: string | null
    logourl?: string | null
  }
  spotPosition?: {
    currentPosition?: {
      amountInUSD?: string | number
      humanized?: string
      amount?: string
    }
    underlyingBalanceUSD?: string | number
    apy?: string | number
    avgApy?: string | number
  }
}

type PodsEarnSection = {
  positions?: PodsEarnPosition[]
  summary?: {
    totalUnderlyingBalanceUSD?: string | number
    totalProfitInUSD?: string | number
  }
}

type PodsHistoryItem = Record<string, unknown> & {
  id?: string
  type?: string
  status?: string
  initialDate?: string
  createdAt?: string
  finishedAt?: string
  amounts?: {
    assetIn?: Record<string, unknown> | null
    assetOut?: Record<string, unknown> | null
  }
  transactions?: Array<Record<string, unknown>>
  detail?: Record<string, unknown>
}

type PodsWalletBalances = {
  tokens?: PodsBalanceSection
  earn?: PodsEarnSection
  history?: {
    items?: PodsHistoryItem[]
  }
}

type WalletDataState = {
  status: WalletDataStatus
  balances?: PodsWalletBalances
  historyItems: PodsHistoryItem[]
  error?: string
  isRefreshing: boolean
}

type PodsWalletFetchResult = {
  balances: PodsWalletBalances
  historyItems: PodsHistoryItem[]
}

type WalletTransferAsset = {
  id: string
  token: WalletTransferSelectedToken
  network: WalletTransferSelectedNetwork
  tokenData: TokenData
  balanceDomain: BalanceDomain
  formattedBalance: string
  balanceAmount: number
  priceUsd: number
}

const hyperEvm = defineChain({
  id: 999,
  name: 'HyperEVM',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.hyperliquid.xyz/evm'],
    },
  },
  blockExplorers: {
    default: {
      name: 'HyperEVM Explorer',
      url: 'https://hyperevmscan.io',
    },
  },
})
const rawSupportedChains: Chain[] = [
  base,
  polygon,
  arbitrum,
  optimism,
  mainnet,
  bsc,
  gnosis,
  avalanche,
  zkSync,
  linea,
  celo,
  hyperEvm,
  baseSepolia,
]
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const erc20TransferAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const
const WALLET_DATA_REFETCH_MS = 10 * 60 * 1000
const WORKSHOP_PREFERENCES_STORAGE_KEY = 'pods-workshop-wallet-preferences'
const DEFAULT_USD_TO_BRL_RATE = 5.5
const emptyWalletDataState: WalletDataState = {
  status: 'idle',
  historyItems: [],
  isRefreshing: false,
}
const defaultWorkshopPreferences: WorkshopPreferences = {
  language: 'EN',
  currency: 'USD',
  usdToBrlRate: DEFAULT_USD_TO_BRL_RATE,
}
const currencyFormatters: Record<WorkshopCurrency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }),
  BRL: new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }),
}
const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 6,
})
const rpcUrlOverrides: Partial<Record<number, string | undefined>> = {
  [base.id]: import.meta.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://base-rpc.publicnode.com',
  [polygon.id]: import.meta.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? 'https://polygon-bor-rpc.publicnode.com',
  [arbitrum.id]: import.meta.env.NEXT_PUBLIC_ARBITRUM_RPC_URL ?? 'https://arbitrum-one-rpc.publicnode.com',
  [optimism.id]: import.meta.env.NEXT_PUBLIC_OPTIMISM_RPC_URL ?? 'https://optimism-rpc.publicnode.com',
  [mainnet.id]: import.meta.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? 'https://ethereum-rpc.publicnode.com',
  [bsc.id]: import.meta.env.NEXT_PUBLIC_BSC_RPC_URL ?? 'https://bsc-rpc.publicnode.com',
  [gnosis.id]: import.meta.env.NEXT_PUBLIC_GNOSIS_RPC_URL ?? 'https://gnosis-rpc.publicnode.com',
  [avalanche.id]: import.meta.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ?? 'https://api.avax.network/ext/bc/C/rpc',
  [zkSync.id]: import.meta.env.NEXT_PUBLIC_ZKSYNC_RPC_URL ?? 'https://mainnet.era.zksync.io',
  [linea.id]: import.meta.env.NEXT_PUBLIC_LINEA_RPC_URL ?? 'https://rpc.linea.build',
  [celo.id]: import.meta.env.NEXT_PUBLIC_CELO_RPC_URL ?? 'https://forno.celo.org',
  [hyperEvm.id]: import.meta.env.NEXT_PUBLIC_HYPEREVM_RPC_URL ?? 'https://rpc.hyperliquid.xyz/evm',
  [baseSepolia.id]: import.meta.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? 'https://base-sepolia-rpc.publicnode.com',
}
const supportedChains: Chain[] = rawSupportedChains.map((chain) => addRpcUrlOverrideToChain(chain, getRpcUrlForChain(chain)))
const defaultPrivyChain = supportedChains.find((chain) => chain.id === base.id) ?? supportedChains[0]
const chainMetadata: Record<number, { name: string; logoUrl?: string; color: string }> = {
  [polygon.id]: {
    name: 'Polygon',
    logoUrl: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    color: '#8247E5',
  },
  [base.id]: {
    name: 'Base',
    logoUrl: 'https://cryptologos.cc/logos/base-logo.png',
    color: '#0052FF',
  },
  [arbitrum.id]: {
    name: 'Arbitrum',
    logoUrl: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    color: '#28A0F0',
  },
  [optimism.id]: {
    name: 'Optimism',
    logoUrl: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    color: '#FF0420',
  },
  [mainnet.id]: {
    name: 'Ethereum',
    logoUrl: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    color: '#627EEA',
  },
  [bsc.id]: {
    name: 'BNB Smart Chain',
    logoUrl: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    color: '#F0B90B',
  },
  [gnosis.id]: {
    name: 'Gnosis',
    logoUrl: 'https://cryptologos.cc/logos/gnosis-gno-gno-logo.png',
    color: '#04795B',
  },
  [avalanche.id]: {
    name: 'Avalanche',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg',
    color: '#E84142',
  },
  [zkSync.id]: {
    name: 'zkSync Era',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_zksync.jpg',
    color: '#4E529A',
  },
  [linea.id]: {
    name: 'Linea',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_linea.jpg',
    color: '#61DFFF',
  },
  [celo.id]: {
    name: 'Celo',
    logoUrl: 'https://icons.llamao.fi/icons/chains/rsz_celo.jpg',
    color: '#35D07F',
  },
  [hyperEvm.id]: {
    name: 'HyperEVM',
    logoUrl: 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/hyperevm.svg',
    color: '#50E3AB',
  },
  [baseSepolia.id]: {
    name: 'Base Sepolia',
    logoUrl: 'https://cryptologos.cc/logos/base-logo.png',
    color: '#0052FF',
  },
}
const deframeChains: DeframeChainInput[] = supportedChains.map((chain) => ({
  ...chain,
  id: chain.id,
  name: chainMetadata[chain.id]?.name ?? chain.name,
  iconUrl: chainMetadata[chain.id]?.logoUrl,
  explorerTxUrl: chain.blockExplorers?.default?.url
    ? `${chain.blockExplorers.default.url.replace(/\/$/, '')}/tx/`
    : undefined,
}))
const podsDeframeBehavior: DeframeBehaviorConfig = {
  swap: {
    initialChainStrategy: 'wallet-balance',
    openProcessingHistoryInline: true,
    showHistoryTooltip: true,
    directionButtonSpacing: 'compact',
  },
  actionSheets: {
    closeOnBackdropClick: true,
    focusSearchOnOpen: true,
    showAssetCategories: true,
  },
}
const phoneNavItems: Array<{
  id: AppTab
  label: string
  Icon: typeof Wallet
}> = [
  { id: 'overview', label: 'Wallet', Icon: Wallet },
  { id: 'receive', label: 'Deposit', Icon: ArrowDown },
  { id: 'swap', label: 'Swap', Icon: ArrowDownUp },
  { id: 'earn', label: 'Earn', Icon: BadgeDollarSign },
  { id: 'activity', label: 'Activity', Icon: Activity },
]

const defaultReceiveToken: WalletTransferSelectedToken = {
  symbol: 'USDC',
  name: 'USD Coin',
  logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
}

const defaultReceiveNetwork: WalletTransferSelectedNetwork = {
  name: 'Base',
  iconUrl: chainMetadata[base.id].logoUrl,
}

const receiveLabels = {
  title: 'Receive',
  subtitle: 'Deposit funds to your smart wallet.',
  tokenLabel: 'Asset',
  tokenPlaceholder: 'Select asset',
  networkLabel: 'Network',
  networkPlaceholder: 'Select network',
  addressTitle: 'Smart wallet address',
  addressSubtitle: 'Use this smart wallet address for deposits.',
  idleTitle: 'Select an asset and network',
  idleSubtitle: 'Your deposit address appears here.',
  submitIdle: 'Select asset',
  submitReady: 'Copy address',
}

const sendLabels = {
  title: 'Send',
  subtitle: 'Transfer assets from your smart wallet.',
  tokenPlaceholder: 'Select asset',
  balanceLabel: 'Balance',
  sourceNetworkLabel: 'From',
  sourceNetworkPlaceholder: 'Select network',
  destinationNetworkLabel: 'To',
  destinationNetworkHint: 'Same network',
  destinationNetworkEmpty: 'Select source network',
  destinationAddressLabel: 'Recipient address',
  destinationAddressPlaceholder: '0x...',
  infoMessage: 'Review the recipient and network before sending.',
  detailsTitle: 'Transfer details',
  detailsAmountLabel: 'Amount',
  detailsFeeLabel: 'Network fee',
  detailsReceiveLabel: 'Recipient receives',
  maxLabel: 'Max',
}

const transferPickerLabels = {
  title: 'Choose asset',
  subtitle: 'Select the network and token for this wallet action.',
  searchPlaceholder: 'Search asset',
  searchingText: 'Loading assets',
  loadMoreButton: 'Load more',
  searchEmptyTitle: 'No asset found',
  searchEmptyDescription: 'Try another network or search term.',
  networksLabel: 'Networks',
  assetsLabel: 'Assets',
  closeAriaLabel: 'Close asset selector',
}

function App() {
  const appId = import.meta.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'wallet'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
        },
        supportedChains,
        defaultChain: defaultPrivyChain,
        appearance: {
          walletChainType: 'ethereum-only',
          theme: 'light',
          accentColor: '#6d7cff',
        },
      }}
    >
      <SmartWalletsProvider>
        <WorkshopWallet />
      </SmartWalletsProvider>
    </PrivyProvider>
  )
}

function WorkshopWallet() {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()
  const { client: smartWalletClient, getClientForChain } = useSmartWallets()
  const podsApiUrl = import.meta.env.NEXT_PUBLIC_PODS_URL
  const podsApiKey = import.meta.env.NEXT_PUBLIC_PODS_API_KEY

  const [activeTab, setActiveTab] = useState<AppTab>('overview')
  const [routeName, setRouteName] = useState('overview')
  const [txLogs, setTxLogs] = useState<string[]>([])
  const [isCreatingWallet, setIsCreatingWallet] = useState(false)
  const [walletData, setWalletData] = useState<WalletDataState>(emptyWalletDataState)
  const [copiedAddressLabel, setCopiedAddressLabel] = useState<string>()
  const [sendAmount, setSendAmount] = useState('')
  const [sendDestinationAddress, setSendDestinationAddress] = useState('')
  const [sendSelectedPercentage, setSendSelectedPercentage] = useState<number | null>(null)
  const [sendTransferError, setSendTransferError] = useState<string | null>(null)
  const [isSendingTransfer, setIsSendingTransfer] = useState(false)
  const [selectedSendAssetId, setSelectedSendAssetId] = useState<string>()
  const [workshopPreferences, setWorkshopPreferences] = useState<WorkshopPreferences>(loadWorkshopPreferences)
  const copyResetTimerRef = useRef<number>(undefined)
  const walletDataControllerRef = useRef<AbortController>(undefined)

  const embeddedWallet = getEmbeddedConnectedWallet(wallets)
  const ownerAddress = normalizeEvmAddress(embeddedWallet?.address)
  const privySmartWalletAddress = normalizeEvmAddress(smartWalletClient?.account?.address)
  const walletAddressForPods = privySmartWalletAddress
  const smartWalletAddressLabel = 'Smart wallet'

  const hasWallet = Boolean(ownerAddress)
  const hasSmartWallet = Boolean(walletAddressForPods)
  const isMissingConfig = !podsApiUrl || !podsApiKey
  const globalCurrencyExchangeRate =
    workshopPreferences.currency === 'BRL' ? workshopPreferences.usdToBrlRate : 1
  useEffect(() => {
    saveWorkshopPreferences(workshopPreferences)
  }, [workshopPreferences])

  const handleLanguageChange = useCallback((language: WorkshopLanguage) => {
    setWorkshopPreferences((current) => ({ ...current, language }))
  }, [])

  const handleCurrencyChange = useCallback((currency: WorkshopCurrency) => {
    setWorkshopPreferences((current) => ({ ...current, currency }))
  }, [])

  const handleUsdToBrlRateChange = useCallback((usdToBrlRate: number) => {
    setWorkshopPreferences((current) => ({
      ...current,
      usdToBrlRate: normalizeUsdToBrlRate(usdToBrlRate),
    }))
  }, [])

  const appendLog = useCallback((entry: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setTxLogs((previous) => [`${timestamp} ${entry}`, ...previous].slice(0, 20))
  }, [])

  const handleCopyAddress = useCallback(
    async (address: string | undefined, label: string) => {
      if (!address) {
        appendLog(`${label} address is not ready`)
        return
      }

      try {
        await copyTextToClipboard(address)
        setCopiedAddressLabel(label)
        appendLog(`${label} address copied`)

        if (copyResetTimerRef.current) {
          window.clearTimeout(copyResetTimerRef.current)
        }

        copyResetTimerRef.current = window.setTimeout(() => {
          setCopiedAddressLabel(undefined)
        }, 1800)
      } catch (error) {
        appendLog(`Copy ${label} address failed: ${getErrorMessage(error)}`)
      }
    },
    [appendLog],
  )

  const handleCreateWallet = useCallback(async () => {
    setIsCreatingWallet(true)
    try {
      await createWallet()
      appendLog('Embedded wallet requested')
    } catch (error) {
      appendLog(`Wallet creation failed: ${getErrorMessage(error)}`)
    } finally {
      setIsCreatingWallet(false)
    }
  }, [appendLog, createWallet])

  const handleConnectOrCreateWallet = useCallback(() => {
    if (!authenticated) {
      login()
      return
    }

    if (!hasWallet) {
      void handleCreateWallet()
    }
  }, [authenticated, handleCreateWallet, hasWallet, login])

  const handleReceive = useCallback(() => {
    if (!walletAddressForPods) {
      handleConnectOrCreateWallet()
    }

    setActiveTab('receive')
  }, [handleConnectOrCreateWallet, walletAddressForPods])

  const handleSend = useCallback(() => {
    if (!walletAddressForPods) {
      handleConnectOrCreateWallet()
    }

    setActiveTab('send')
  }, [handleConnectOrCreateWallet, walletAddressForPods])

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current)
      }
    }
  }, [])

  const loadWalletData = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!walletAddressForPods || isMissingConfig) {
        setWalletData(emptyWalletDataState)
        return
      }

      walletDataControllerRef.current?.abort()
      const controller = new AbortController()
      walletDataControllerRef.current = controller

      setWalletData((current) => ({
        ...current,
        status: mode === 'initial' ? 'loading' : current.status,
        error: undefined,
        isRefreshing: mode === 'refresh',
      }))

      try {
        const result = await fetchPodsWalletData({
          baseUrl: podsApiUrl,
          apiKey: podsApiKey,
          wallet: walletAddressForPods,
          signal: controller.signal,
        })

        setWalletData({
          status: 'ready',
          balances: result.balances,
          historyItems: result.historyItems,
          isRefreshing: false,
        })
        appendLog(`Wallet v2 refreshed ${formatAddress(walletAddressForPods)}`)
      } catch (error) {
        if (controller.signal.aborted) return

        setWalletData((current) => ({
          ...current,
          status: 'error',
          error: getErrorMessage(error),
          isRefreshing: false,
        }))
      }
    },
    [appendLog, isMissingConfig, podsApiKey, podsApiUrl, walletAddressForPods],
  )

  const handleRefreshWalletData = useCallback(() => {
    void loadWalletData('refresh')
  }, [loadWalletData])

  useEffect(() => {
    if (!walletAddressForPods || isMissingConfig) {
      setWalletData(emptyWalletDataState)
      return
    }

    let pollingId: number | undefined

    void loadWalletData('initial')
    pollingId = window.setInterval(() => {
      void loadWalletData('refresh')
    }, WALLET_DATA_REFETCH_MS)

    return () => {
      walletDataControllerRef.current?.abort()
      if (pollingId) window.clearInterval(pollingId)
    }
  }, [isMissingConfig, loadWalletData, walletAddressForPods])

  const processBytecode = useCallback<ProcessBytecode>(
    async (payload, ctx) => {
      const emit = (event: TxUpdateEvent) => {
        ctx.updateTxStatus(event)
        appendLog(formatTxEvent(event))
      }

      if (!ready || !authenticated || !ownerAddress) {
        emit({
          type: 'SIGNATURE_ERROR',
          clientTxId: payload.clientTxId,
          code: 'NO_WALLET',
          message: 'No Privy wallet is connected.',
        })
        return
      }

      if (!walletAddressForPods || !smartWalletClient) {
        emit({
          type: 'SIGNATURE_ERROR',
          clientTxId: payload.clientTxId,
          code: 'NO_SMART_WALLET',
          message: 'Wait for the Privy smart wallet client before executing Pods bytecode.',
        })
        return
      }

      emit({ type: 'HOST_ACK', clientTxId: payload.clientTxId })

      if (payload.bytecodes.length === 0) {
        emit({
          type: 'SIGNATURE_ERROR',
          clientTxId: payload.clientTxId,
          code: 'NO_BYTECODE',
          message: 'Pods did not return bytecode for this action.',
        })
        return
      }

      const firstBytecode = payload.bytecodes[0]
      const chainId = normalizeBytecodeChainId(firstBytecode.chainId) ?? base.id
      const chain = getSupportedChainById(chainId)

      if (!chain) {
        emit({
          type: 'SIGNATURE_ERROR',
          clientTxId: payload.clientTxId,
          code: 'CHAIN_NOT_SUPPORTED',
          message: `Chain ${chainId} is not configured in this workshop app.`,
        })
        return
      }

      let chainClient: Awaited<ReturnType<typeof getClientForChain>> | undefined
      try {
        chainClient = await getClientForChain({ id: chainId })
      } catch (error) {
        emit({
          type: 'SIGNATURE_ERROR',
          clientTxId: payload.clientTxId,
          code: 'CHAIN_NOT_CONFIGURED',
          message: getErrorMessage(error),
        })
        return
      }

      if (!chainClient) {
        emit({
          type: 'SIGNATURE_ERROR',
          clientTxId: payload.clientTxId,
          code: 'CHAIN_NOT_CONFIGURED',
          message: `Privy smart wallets are not configured for chain ${chainId}.`,
        })
        return
      }

      try {
        emit({ type: 'SIGNATURE_PROMPTED', clientTxId: payload.clientTxId })
        const txHash = await chainClient.sendTransaction({
          calls: payload.bytecodes.map((bytecode) => ({
            to: bytecode.to as Address,
            data: bytecode.data as Hex,
            value: bytecode.value ? BigInt(bytecode.value) : 0n,
          })),
        })

        emit({
          type: 'TX_SUBMITTED',
          clientTxId: payload.clientTxId,
          chainId,
          txHash,
        })

        const publicClient = createPublicClient({
          chain,
          transport: http(getRpcUrlForChain(chain)),
        })
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        })

        emit({
          type: 'TX_CONFIRMED',
          clientTxId: payload.clientTxId,
          txHash,
          blockNumber: Number(receipt.blockNumber),
          confirmations: 1,
        })
        emit({
          type: 'TX_FINALIZED',
          clientTxId: payload.clientTxId,
          txHash,
        })
      } catch (error) {
        const message = getErrorMessage(error)
        const wasRejected = isUserRejectedError(message)
        emit({
          type: wasRejected ? 'SIGNATURE_DECLINED' : 'SIGNATURE_ERROR',
          clientTxId: payload.clientTxId,
          code: wasRejected ? undefined : 'SMART_WALLET_EXECUTION_FAILED',
          message,
        })
      }
    },
    [appendLog, authenticated, getClientForChain, ownerAddress, ready, smartWalletClient, walletAddressForPods],
  )

  const podsConfig = useMemo<DeframeConfig>(
    () => ({
      DEFRAME_API_URL: import.meta.env.NEXT_PUBLIC_PODS_URL,
      DEFRAME_API_KEY: import.meta.env.NEXT_PUBLIC_PODS_API_KEY,
      DEFRAME_WEBSOCKET_URL: import.meta.env.NEXT_PUBLIC_PODS_WEBSOCKET_URL,
      walletAddress: walletAddressForPods,
      userId: user?.id,
      chains: deframeChains,
      language: workshopPreferences.language,
      globalCurrency: workshopPreferences.currency,
      globalCurrencyExchangeRate,
      enableCrossChainInvestments: true,
      strategiesLimit: 24,
      debug: import.meta.env.DEV,
      components: {
        SwapFormView: PodsSwapFormView,
      },
      behavior: podsDeframeBehavior,
      theme: {
        mode: 'light',
        preset: 'default',
        overrides: {
          light: {
            colors: {
              brandPrimary: '#6d7cff',
              brandSecondary: '#5062f5',
              bgDefault: '#f6f8ff',
              bgSubtle: '#eef2ff',
              bgMuted: '#e4e9ff',
              bgRaised: '#ffffff',
              textPrimary: '#111827',
              textSecondary: '#647084',
              textDisabled: '#98a2b3',
              stateSuccess: '#6d7cff',
              stateWarning: '#d97706',
              stateError: '#dc2626',
            },
          },
        },
      },
    }),
    [globalCurrencyExchangeRate, user?.id, walletAddressForPods, workshopPreferences.currency, workshopPreferences.language],
  )

  const canRenderWidgets = authenticated && Boolean(walletAddressForPods) && !isMissingConfig
  const walletDashboardTokens = useMemo(
    () => getDashboardTokensFromBalances(walletData.balances?.tokens, workshopPreferences),
    [walletData.balances?.tokens, workshopPreferences],
  )
  const transferAssets = useMemo(
    () => getTransferAssetsFromBalances(walletData.balances?.tokens, { requirePositiveBalance: true }),
    [walletData.balances?.tokens],
  )
  const depositAssets = useMemo(
    () => getDepositTransferAssets(walletData.balances?.tokens),
    [walletData.balances?.tokens],
  )
  const walletTotals = useMemo(
    () => getWalletTotals(walletData.balances, workshopPreferences),
    [walletData.balances, workshopPreferences],
  )
  const sendAsset = useMemo(
    () => getSelectedTransferAsset(transferAssets, selectedSendAssetId),
    [selectedSendAssetId, transferAssets],
  )
  const sendAmountValue = toFiniteNumber(sendAmount)
  const sendAmountUsd = sendAsset ? sendAmountValue * sendAsset.priceUsd : 0
  const sendAmountWarning = getSendAmountWarning({
    asset: sendAsset,
    amount: sendAmountValue,
  })
  const sendSubmitDisabled = isSendSubmitDisabled({
    asset: sendAsset,
    amount: sendAmountValue,
    destinationAddress: sendDestinationAddress,
  })
  const sendDetails = getSendDetails(sendAsset, sendAmount)
  const canRenderTransferViews = authenticated && Boolean(walletAddressForPods)

  const handleSendAmountChange = useCallback((value: string) => {
    setSendAmount(value)
    setSendSelectedPercentage(null)
    setSendTransferError(null)
  }, [])

  const handleSendDestinationAddressChange = useCallback((value: string) => {
    setSendDestinationAddress(value)
    setSendTransferError(null)
  }, [])

  const handleSendMaxClick = useCallback(() => {
    if (!sendAsset) return
    setSendAmount(formatPlainAmount(sendAsset.balanceAmount))
    setSendSelectedPercentage(100)
    setSendTransferError(null)
  }, [sendAsset])

  const handleSendPercentageSelect = useCallback(
    (percentage: number) => {
      if (!sendAsset) return
      setSendAmount(formatPlainAmount((sendAsset.balanceAmount * percentage) / 100))
      setSendSelectedPercentage(percentage)
      setSendTransferError(null)
    },
    [sendAsset],
  )

  const handleSendAssetSelect = useCallback((asset: WalletTransferAsset) => {
    setSelectedSendAssetId(asset.id)
    setSendAmount('')
    setSendSelectedPercentage(null)
    setSendTransferError(null)
  }, [])

  const handleTransferSubmit = useCallback(async () => {
    const destinationAddress = normalizeEvmAddress(sendDestinationAddress.trim())

    if (!sendAsset || !destinationAddress) {
      setSendTransferError('Select an asset and a valid destination address.')
      return
    }

    if (!walletAddressForPods || !smartWalletClient) {
      setSendTransferError('Wait for the Privy smart wallet client before sending.')
      return
    }

    const chainId = sendAsset.tokenData.chainId
    const chain = getSupportedChainById(chainId)

    if (!chain) {
      setSendTransferError(`Chain ${chainId} is not configured in this workshop app.`)
      return
    }

    let amount: bigint
    try {
      amount = parseUnits(sendAmount, sendAsset.tokenData.decimals)
    } catch {
      setSendTransferError('Enter a valid amount for this asset.')
      return
    }

    if (amount <= 0n) {
      setSendTransferError('Enter an amount greater than zero.')
      return
    }

    setIsSendingTransfer(true)
    setSendTransferError(null)

    try {
      const chainClient = await getClientForChain({ id: chainId })
      if (!chainClient) {
        throw new Error(`Privy smart wallets are not configured for chain ${chainId}.`)
      }

      const txHash = await chainClient.sendTransaction({
        calls: [getTransferCall(sendAsset, destinationAddress, amount)],
      })

      appendLog(`Send submitted ${txHash.slice(0, 10)}...`)
      const publicClient = createPublicClient({
        chain,
        transport: http(getRpcUrlForChain(chain)),
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      appendLog(`Send confirmed ${txHash.slice(0, 10)}...`)
      setSendAmount('')
      setSendSelectedPercentage(null)
      void loadWalletData('refresh')
    } catch (error) {
      setSendTransferError(getErrorMessage(error))
    } finally {
      setIsSendingTransfer(false)
    }
  }, [
    appendLog,
    getClientForChain,
    loadWalletData,
    sendAmount,
    sendAsset,
    sendDestinationAddress,
    smartWalletClient,
    walletAddressForPods,
  ])

  return (
    <main className="app-shell deframe-widget">
      <section className="phone-screen" aria-label="Workshop smart wallet">
        <header className="phone-header">
          <button className="phone-header-button" type="button" onClick={() => setActiveTab('activity')} aria-label="Open activity">
            <Grid2X2 size={22} aria-hidden="true" />
          </button>
          <h1>My Wallet</h1>
          <button
            className="phone-avatar-button"
            type="button"
            onClick={authenticated ? () => void logout() : login}
            disabled={!authenticated && !ready}
            aria-label={authenticated ? 'Sign out' : 'Connect wallet'}
          >
            {authenticated ? <LogOut size={24} aria-hidden="true" /> : <LogIn size={24} aria-hidden="true" />}
          </button>
        </header>

        <div className="notice-stack phone-notice-stack">
          {authenticated && !hasWallet ? (
            <section className="notice-band">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Privy authenticated. Create the embedded wallet.</span>
              <button className="secondary-button" type="button" onClick={() => void handleCreateWallet()} disabled={isCreatingWallet}>
                {isCreatingWallet ? 'Creating' : 'Create wallet'}
              </button>
            </section>
          ) : null}

          {authenticated && hasWallet && !hasSmartWallet ? (
            <section className="notice-band">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>Smart wallet client is initializing.</span>
            </section>
          ) : null}

          {isMissingConfig ? (
            <section className="notice-band warning">
              <Activity size={18} aria-hidden="true" />
              <span>Pods env is incomplete.</span>
            </section>
          ) : null}
        </div>

        <section className="content-panel phone-content">
            {activeTab === 'overview' ? (
              <OverviewPanel
                smartWalletAddress={walletAddressForPods}
                smartWalletAddressLabel={smartWalletAddressLabel}
                walletDataStatus={walletData.status}
                walletDataError={walletData.error}
                walletTotals={walletTotals}
                isRefreshing={walletData.isRefreshing}
                copiedAddressLabel={copiedAddressLabel}
                dashboardTokens={walletDashboardTokens}
                preferences={workshopPreferences}
                onRefreshWalletData={handleRefreshWalletData}
                onCopyAddress={handleCopyAddress}
                onCurrencyChange={handleCurrencyChange}
                onDepositClick={handleReceive}
                onWithdrawClick={handleSend}
                onSwapClick={() => setActiveTab('swap')}
              />
            ) : null}

            {activeTab === 'receive' && canRenderTransferViews ? (
              <ReceivePanel
                smartWalletAddress={walletAddressForPods}
                smartWalletAddressLabel={smartWalletAddressLabel}
                availableAssets={depositAssets}
                walletDataStatus={walletData.status}
                walletDataError={walletData.error}
                preferences={workshopPreferences}
                onCopyAddress={handleCopyAddress}
              />
            ) : null}

            {activeTab === 'send' && canRenderTransferViews ? (
              <SendPanel
                asset={sendAsset}
                availableAssets={transferAssets}
                walletDataStatus={walletData.status}
                walletDataError={walletData.error}
                amount={sendAmount}
                amountUsd={sendAmountUsd}
                destinationAddress={sendDestinationAddress}
                details={sendDetails}
                selectedPercentage={sendSelectedPercentage}
                amountWarning={sendAmountWarning}
                submitDisabled={sendSubmitDisabled}
                isProcessing={isSendingTransfer}
                transferError={sendTransferError}
                preferences={workshopPreferences}
                onAmountChange={handleSendAmountChange}
                onDestinationAddressChange={handleSendDestinationAddressChange}
                onMaxClick={handleSendMaxClick}
                onPercentageSelect={handleSendPercentageSelect}
                onAssetSelect={handleSendAssetSelect}
                onSubmit={handleTransferSubmit}
              />
            ) : null}

            {activeTab === 'swap' && canRenderWidgets ? (
              <WidgetPanel config={podsConfig} processBytecode={processBytecode} testId="swap-page">
                <SwapWidget autoHeight />
              </WidgetPanel>
            ) : null}

            {activeTab === 'earn' && canRenderWidgets ? (
              <WidgetPanel config={podsConfig} processBytecode={processBytecode} testId="earn-page">
                <EarnWidget autoHeight onRouteChange={setRouteName} />
              </WidgetPanel>
            ) : null}

            {activeTab === 'activity' ? (
              <ActivityPanel
                logs={txLogs}
                routeName={routeName}
                historyItems={walletData.historyItems}
                walletDataStatus={walletData.status}
                walletDataError={walletData.error}
                preferences={workshopPreferences}
                onLanguageChange={handleLanguageChange}
                onCurrencyChange={handleCurrencyChange}
                onUsdToBrlRateChange={handleUsdToBrlRateChange}
              />
            ) : null}

            {(activeTab === 'receive' || activeTab === 'send') && !canRenderTransferViews ? (
              <EmptyWidgetState authenticated={authenticated} missingConfig={false} onConnect={handleConnectOrCreateWallet} />
            ) : null}

            {(activeTab === 'swap' || activeTab === 'earn') && !canRenderWidgets ? (
              <EmptyWidgetState authenticated={authenticated} missingConfig={isMissingConfig} onConnect={handleConnectOrCreateWallet} />
            ) : null}
        </section>

        <nav className="phone-bottom-nav" aria-label="Wallet sections">
          {phoneNavItems.map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                className={isActive ? 'phone-nav-item active' : 'phone-nav-item'}
                type="button"
                key={id}
                onClick={() => setActiveTab(id)}
                aria-label={label}
                title={label}
              >
                <Icon size={24} aria-hidden="true" />
              </button>
            )
          })}
        </nav>
      </section>
    </main>
  )
}

function OverviewPanel({
  smartWalletAddress,
  smartWalletAddressLabel,
  walletDataStatus,
  walletDataError,
  walletTotals,
  isRefreshing,
  copiedAddressLabel,
  dashboardTokens,
  preferences,
  onRefreshWalletData,
  onCopyAddress,
  onCurrencyChange,
  onDepositClick,
  onWithdrawClick,
  onSwapClick,
}: {
  smartWalletAddress?: string
  smartWalletAddressLabel: string
  walletDataStatus: WalletDataStatus
  walletDataError?: string
  walletTotals: ReturnType<typeof getWalletTotals>
  isRefreshing: boolean
  copiedAddressLabel?: string
  dashboardTokens: DashboardTokenItem[]
  preferences: WorkshopPreferences
  onRefreshWalletData: () => void
  onCopyAddress: (address: string | undefined, label: string) => Promise<void>
  onCurrencyChange: (currency: WorkshopCurrency) => void
  onDepositClick: () => void
  onWithdrawClick: () => void
  onSwapClick: () => void
}) {
  const isLoading = walletDataStatus === 'loading'
  const walletSyncLabel = getWalletSyncLabel(walletDataStatus, isRefreshing)
  const visibleTokens = dashboardTokens.slice(0, 6)
  const formattedTotal = isLoading ? 'Loading' : walletTotals.formattedTotal
  const copiedSmartWallet = copiedAddressLabel === smartWalletAddressLabel

  return (
    <div data-testid="dashboard-page" className="phone-overview">
      <section className="phone-balance-panel" aria-label="Wallet balance">
        <div className="phone-balance-topline">
          <span>
            Total Balance
            <EyeOff size={21} aria-hidden="true" />
          </span>
          <label className="currency-selector">
            <span className="sr-only">Currency</span>
            <select value={preferences.currency} onChange={(event) => onCurrencyChange(event.target.value as WorkshopCurrency)}>
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
            </select>
            <ChevronDown size={22} aria-hidden="true" />
          </label>
        </div>
        <div className="phone-balance-row">
          <strong>{formattedTotal}</strong>
          <span>{walletSyncLabel}</span>
        </div>
        <button
          className="smart-address-chip"
          type="button"
          onClick={() => void onCopyAddress(smartWalletAddress, smartWalletAddressLabel)}
          disabled={!smartWalletAddress}
        >
          <Copy size={16} aria-hidden="true" />
          {copiedSmartWallet ? 'Copied' : formatAddress(smartWalletAddress)}
        </button>
      </section>

      <section className="phone-action-bar" aria-label="Wallet actions">
        <button className="phone-action-pill" type="button" onClick={onDepositClick}>
          <ArrowDown size={29} aria-hidden="true" />
          Deposit
        </button>
        <button className="phone-swap-button" type="button" onClick={onSwapClick} aria-label="Swap assets">
          <ArrowDownUp size={29} aria-hidden="true" />
        </button>
        <button className="phone-action-pill" type="button" onClick={onWithdrawClick}>
          <ArrowUp size={29} aria-hidden="true" />
          Withdraw
        </button>
      </section>

      <section className="phone-assets-section" aria-label="Wallet assets">
        <div className="phone-assets-heading">
          <h2>My Assets</h2>
          <button className="phone-search-button" type="button" onClick={onRefreshWalletData} disabled={isRefreshing} aria-label="Refresh assets">
            {isRefreshing ? <RefreshCw size={26} aria-hidden="true" /> : <Search size={26} aria-hidden="true" />}
          </button>
        </div>

        {walletDataError ? <p className="phone-error-copy">Assets unavailable: {walletDataError}</p> : null}

        {!walletDataError && visibleTokens.length > 0 ? (
          <ol className="phone-asset-list">
            {visibleTokens.map((token) => (
              <PhoneAssetRow key={token.id} token={token} />
            ))}
          </ol>
        ) : null}

        {!walletDataError && !isLoading && visibleTokens.length === 0 ? (
          <div className="phone-empty-assets">
            <Wallet size={28} aria-hidden="true" />
            <strong>No assets yet</strong>
            <span>Deposit into the smart wallet address to start.</span>
          </div>
        ) : null}

        {!walletDataError && isLoading ? <p className="phone-muted-copy">Loading assets from Pods.</p> : null}
      </section>
    </div>
  )
}

function PhoneAssetRow({ token }: { token: DashboardTokenItem }) {
  const tokenColor = getDashboardTokenColor(token)

  return (
    <li className="phone-asset-row">
      <div className="phone-token-icon" style={{ backgroundColor: tokenColor }}>
        {token.logoUrl ? <img src={token.logoUrl} alt="" /> : <span>{token.symbol.slice(0, 1)}</span>}
      </div>
      <div className="phone-token-copy">
        <strong>{token.symbol}</strong>
        <span>{token.formattedAmount}</span>
      </div>
      <div className="phone-token-value">
        <strong>{token.formattedFiatValue}</strong>
        <span>{token.networkName ?? 'Smart wallet'}</span>
      </div>
    </li>
  )
}

function getWalletSyncLabel(walletDataStatus: WalletDataStatus, isRefreshing: boolean) {
  if (isRefreshing) return 'Refreshing'

  switch (walletDataStatus) {
    case 'ready':
      return 'Synced'
    case 'loading':
      return 'Syncing'
    case 'error':
      return 'Unavailable'
    case 'idle':
      return 'Waiting'
  }
}

function ReceivePanel({
  smartWalletAddress,
  smartWalletAddressLabel,
  availableAssets,
  walletDataStatus,
  walletDataError,
  preferences,
  onCopyAddress,
}: {
  smartWalletAddress?: Address
  smartWalletAddressLabel: string
  availableAssets: WalletTransferAsset[]
  walletDataStatus: WalletDataStatus
  walletDataError?: string
  preferences: WorkshopPreferences
  onCopyAddress: (address: string | undefined, label: string) => Promise<void>
}) {
  const [selectedAssetId, setSelectedAssetId] = useState<string>()
  const [assetNetworkSearch, setAssetNetworkSearch] = useState('')
  const [activePickerNetwork, setActivePickerNetwork] = useState<NetworkOption | null>(null)
  const [isAssetNetworkPickerOpen, setIsAssetNetworkPickerOpen] = useState(false)
  const selectedAsset = getSelectedTransferAsset(availableAssets, selectedAssetId)
  const pickerState = getTransferPickerState({
    assets: availableAssets,
    selectedAsset,
    activePickerNetwork,
    search: assetNetworkSearch,
    walletDataStatus,
    walletDataError,
    preferences,
  })
  const isReady = Boolean(smartWalletAddress && selectedAsset)

  const closeAssetNetworkPicker = () => {
    setIsAssetNetworkPickerOpen(false)
    setActivePickerNetwork(null)
    setAssetNetworkSearch('')
  }

  const openAssetNetworkPicker = () => {
    setActivePickerNetwork(pickerState.selectedNetwork)
    setIsAssetNetworkPickerOpen(true)
  }

  const handleAssetNetworkSelect = (tokenData: TokenData) => {
    const nextAsset = findTransferAssetByTokenData(availableAssets, tokenData)
    if (!nextAsset) return

    setSelectedAssetId(nextAsset.id)
    closeAssetNetworkPicker()
  }

  return (
    <>
      <WalletOnchainDepositView
        token={selectedAsset?.token ?? null}
        network={selectedAsset?.network ?? null}
        networkCount={getNetworkCountForAsset(availableAssets, selectedAsset)}
        depositAddress={smartWalletAddress ?? null}
        warningMessage={getDepositWarningMessage(selectedAsset)}
        isPreparing={walletDataStatus === 'loading' && !selectedAsset}
        isReady={isReady}
        onTokenClick={openAssetNetworkPicker}
        onNetworkClick={openAssetNetworkPicker}
        onAddressCopy={(address) => void onCopyAddress(address, smartWalletAddressLabel)}
        onSubmit={() => void onCopyAddress(smartWalletAddress, smartWalletAddressLabel)}
        labels={receiveLabels}
        className="wallet-transfer-view"
      />

      <WalletTransferAssetNetworkPicker
        isOpen={isAssetNetworkPickerOpen}
        onClose={closeAssetNetworkPicker}
        networks={pickerState.networks}
        selectedNetwork={pickerState.selectedNetwork}
        onNetworkSelect={setActivePickerNetwork}
        displayedTokens={pickerState.status === 'idle' ? pickerState.displayedTokens : []}
        findBalance={(tokenData) => findTransferBalance(availableAssets, tokenData)}
        formatTokenAmount={formatPickerTokenAmount}
        formatCurrencyValue={(value) => formatCurrencyAmount(value, preferences)}
        onAssetClick={handleAssetNetworkSelect}
        onSearch={setAssetNetworkSearch}
        autoFocus
        isFetching={pickerState.status === 'loading'}
        labels={getTransferPickerLabels(pickerState.status, walletDataError)}
      />
    </>
  )
}

function SendPanel({
  asset,
  availableAssets,
  walletDataStatus,
  walletDataError,
  amount,
  amountUsd,
  destinationAddress,
  details,
  selectedPercentage,
  amountWarning,
  submitDisabled,
  isProcessing,
  transferError,
  preferences,
  onAmountChange,
  onDestinationAddressChange,
  onMaxClick,
  onPercentageSelect,
  onAssetSelect,
  onSubmit,
}: {
  asset: WalletTransferAsset | null
  availableAssets: WalletTransferAsset[]
  walletDataStatus: WalletDataStatus
  walletDataError?: string
  amount: string
  amountUsd: number
  destinationAddress: string
  details: WalletOnchainWithdrawDetails | null
  selectedPercentage: number | null
  amountWarning: string | null
  submitDisabled: boolean
  isProcessing: boolean
  transferError: string | null
  preferences: WorkshopPreferences
  onAmountChange: (value: string) => void
  onDestinationAddressChange: (value: string) => void
  onMaxClick: () => void
  onPercentageSelect: (percentage: number) => void
  onAssetSelect: (asset: WalletTransferAsset) => void
  onSubmit: () => void
}) {
  const [assetNetworkSearch, setAssetNetworkSearch] = useState('')
  const [activePickerNetwork, setActivePickerNetwork] = useState<NetworkOption | null>(null)
  const [isAssetNetworkPickerOpen, setIsAssetNetworkPickerOpen] = useState(false)
  const pickerState = getTransferPickerState({
    assets: availableAssets,
    selectedAsset: asset,
    activePickerNetwork,
    search: assetNetworkSearch,
    walletDataStatus,
    walletDataError,
    preferences,
  })
  const feedback = transferError
    ? {
        variant: 'error' as const,
        title: 'Transfer unavailable',
        subtitle: transferError,
      }
    : null

  const closeAssetNetworkPicker = () => {
    setIsAssetNetworkPickerOpen(false)
    setActivePickerNetwork(null)
    setAssetNetworkSearch('')
  }

  const openAssetNetworkPicker = () => {
    setActivePickerNetwork(pickerState.selectedNetwork)
    setIsAssetNetworkPickerOpen(true)
  }

  const handleAssetNetworkSelect = (tokenData: TokenData) => {
    const nextAsset = findTransferAssetByTokenData(availableAssets, tokenData)
    if (!nextAsset) return

    onAssetSelect(nextAsset)
    closeAssetNetworkPicker()
  }

  return (
    <>
      <WalletOnchainWithdrawView
        token={asset?.token ?? null}
        network={asset?.network ?? null}
        networkCount={getNetworkCountForAsset(availableAssets, asset)}
        formattedBalance={asset?.formattedBalance ?? '0'}
        amount={amount}
        formattedAmountValue={formatCurrencyAmount(amountUsd, preferences)}
        destinationAddress={destinationAddress}
        destinationNetwork={asset?.network ?? null}
        details={details}
        isProcessing={isProcessing}
        isAmountDisabled={!asset}
        showMaxButton={Boolean(asset)}
        minAmountWarning={amountWarning}
        walletError={asset ? null : 'No transferable assets found.'}
        transferError={null}
        finalWarning={null}
        submitDisabled={submitDisabled || isProcessing}
        submitLabel={isProcessing ? 'Sending' : 'Send'}
        onTokenClick={openAssetNetworkPicker}
        onNetworkClick={openAssetNetworkPicker}
        onAmountChange={onAmountChange}
        onMaxClick={onMaxClick}
        onPercentageSelect={onPercentageSelect}
        selectedPercentage={selectedPercentage}
        onDestinationAddressChange={onDestinationAddressChange}
        onSubmit={onSubmit}
        labels={sendLabels}
        className="wallet-transfer-view"
        feedback={feedback}
      />

      <WalletTransferAssetNetworkPicker
        isOpen={isAssetNetworkPickerOpen}
        onClose={closeAssetNetworkPicker}
        networks={pickerState.networks}
        selectedNetwork={pickerState.selectedNetwork}
        onNetworkSelect={setActivePickerNetwork}
        displayedTokens={pickerState.status === 'idle' ? pickerState.displayedTokens : []}
        findBalance={(tokenData) => findTransferBalance(availableAssets, tokenData)}
        formatTokenAmount={formatPickerTokenAmount}
        formatCurrencyValue={(value) => formatCurrencyAmount(value, preferences)}
        onAssetClick={handleAssetNetworkSelect}
        onSearch={setAssetNetworkSearch}
        autoFocus
        isFetching={pickerState.status === 'loading'}
        labels={getTransferPickerLabels(pickerState.status, walletDataError)}
      />
    </>
  )
}

function WidgetPanel({
  config,
  processBytecode,
  testId,
  children,
}: {
  config: DeframeConfig
  processBytecode: ProcessBytecode
  testId: string
  children: ReactNode
}) {
  return (
    <DeframeProvider config={config} processBytecode={processBytecode}>
      <div data-testid={testId} className="workshop-widget-page">
        <div data-testid="widget-container" className="workshop-widget-container">
          {children}
        </div>
      </div>
    </DeframeProvider>
  )
}

function ActivityPanel({
  logs,
  routeName,
  historyItems,
  walletDataStatus,
  walletDataError,
  preferences,
  onLanguageChange,
  onCurrencyChange,
  onUsdToBrlRateChange,
}: {
  logs: string[]
  routeName: string
  historyItems: PodsHistoryItem[]
  walletDataStatus: WalletDataStatus
  walletDataError?: string
  preferences: WorkshopPreferences
  onLanguageChange: (language: WorkshopLanguage) => void
  onCurrencyChange: (currency: WorkshopCurrency) => void
  onUsdToBrlRateChange: (rate: number) => void
}) {
  const visibleHistoryItems = historyItems.slice(0, 8)
  let historyContent = <p className="muted-copy">No wallet history yet.</p>

  if (walletDataStatus === 'loading') {
    historyContent = <p className="muted-copy">Loading wallet history.</p>
  }

  if (walletDataError) {
    historyContent = <p className="muted-copy">Wallet history unavailable: {walletDataError}</p>
  }

  if (walletDataStatus !== 'loading' && !walletDataError && visibleHistoryItems.length > 0) {
    historyContent = (
      <ol className="history-list">
        {visibleHistoryItems.map((item, index) => {
          const historyItem = getHistoryDisplay(item, index)
          return (
            <li key={historyItem.id}>
              <div>
                <span>{historyItem.title}</span>
                <small>{historyItem.subtitle}</small>
              </div>
              <strong>{historyItem.amount}</strong>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <DashboardCard className="activity-panel">
      <div className="section-heading">
        <History size={18} aria-hidden="true" />
        <h2>Activity</h2>
      </div>
      <section className="preferences-panel" aria-label="Workshop settings">
        <label className="preference-field">
          <span>Language</span>
          <select value={preferences.language} onChange={(event) => onLanguageChange(event.target.value as WorkshopLanguage)}>
            <option value="EN">English</option>
            <option value="PT">Português</option>
          </select>
        </label>
        <label className="preference-field">
          <span>Currency</span>
          <select value={preferences.currency} onChange={(event) => onCurrencyChange(event.target.value as WorkshopCurrency)}>
            <option value="USD">USD</option>
            <option value="BRL">BRL</option>
          </select>
        </label>
        {preferences.currency === 'BRL' ? (
          <label className="preference-field">
            <span>USD/BRL</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={preferences.usdToBrlRate}
              onChange={(event) => onUsdToBrlRateChange(Number(event.target.value))}
            />
          </label>
        ) : null}
      </section>
      <div className="route-chip">Route: {routeName}</div>
      <section className="activity-section">
        <h3>Wallet history</h3>
        {historyContent}
      </section>
      <section className="activity-section">
        <h3>Workshop events</h3>
      {logs.length === 0 ? (
        <p className="muted-copy">No transaction events yet.</p>
      ) : (
        <ol className="log-list">
          {logs.map((log, index) => (
            <li key={`${log}-${index}`}>{log}</li>
          ))}
        </ol>
      )}
      </section>
    </DashboardCard>
  )
}

function EmptyWidgetState({
  authenticated,
  missingConfig,
  onConnect,
}: {
  authenticated: boolean
  missingConfig: boolean
  onConnect: () => void
}) {
  const message = getEmptyWidgetMessage(authenticated, missingConfig)
  return (
    <DashboardCard className="empty-state">
      <ShieldCheck size={26} aria-hidden="true" />
      <h2>{message.title}</h2>
      <p>{message.body}</p>
      {!authenticated ? (
        <button className="primary-button" type="button" onClick={onConnect}>
          <Play size={17} aria-hidden="true" />
          Connect
        </button>
      ) : null}
    </DashboardCard>
  )
}

function getEmptyWidgetMessage(authenticated: boolean, missingConfig: boolean) {
  if (missingConfig) {
    return {
      title: 'Pods config missing',
      body: 'The wallet shell is loaded, but the Pods widgets need public API env values.',
    }
  }

  if (!authenticated) {
    return {
      title: 'Connect to continue',
      body: 'Privy will create or attach the wallet session for this workshop flow.',
    }
  }

  return {
    title: 'Wallet initializing',
    body: 'Waiting for the Privy smart wallet client address.',
  }
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textArea)

  if (!copied) {
    throw new Error('Clipboard copy was blocked')
  }
}

async function fetchPodsWalletData({
  baseUrl,
  apiKey,
  wallet,
  signal,
}: {
  baseUrl: string
  apiKey: string
  wallet: Address
  signal: AbortSignal
}): Promise<PodsWalletFetchResult> {
  const endpoint = buildPodsWalletEndpoint({ baseUrl, wallet })
  const response = await fetch(endpoint, {
    signal,
    headers: {
      accept: 'application/json',
      'x-api-key': apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(await getPodsApiErrorMessage(response))
  }

  return normalizePodsWalletResponse(await response.json())
}

function buildPodsWalletEndpoint({
  baseUrl,
  wallet,
}: {
  baseUrl: string
  wallet: Address
}) {
  return `${baseUrl.replace(/\/$/, '')}/v2/wallets/${wallet}`
}

async function getPodsApiErrorMessage(response: Response) {
  const fallbackMessage = `Pods API request failed with HTTP ${response.status}`

  try {
    const data: unknown = await response.json()
    if (!isRecord(data)) return fallbackMessage

    const error = getOptionalString(data.error) ?? getOptionalString(data.message)
    return error ?? fallbackMessage
  } catch {
    return fallbackMessage
  }
}

function normalizePodsWalletResponse(payload: unknown): PodsWalletFetchResult {
  const root = isRecord(payload) ? payload : {}
  const data = isRecord(root.data) ? root.data : root
  const tokens = isRecord(data.tokens) ? (data.tokens as PodsBalanceSection) : undefined
  const earn = isRecord(data.earn) ? (data.earn as PodsEarnSection) : undefined
  const historyItems = getPodsHistoryItems(data)

  return {
    balances: {
      tokens,
      earn,
      history: {
        items: historyItems,
      },
    },
    historyItems,
  }
}

function getPodsHistoryItems(data: Record<string, unknown>) {
  const history = isRecord(data.history) ? data.history : undefined
  const transactions = isRecord(data.transactions) ? data.transactions : undefined
  const historyItems = getRecordArray(history?.items)
  const transactionItems = getRecordArray(transactions?.items)
  const directItems = getRecordArray(data.items)

  if (historyItems.length > 0) return historyItems
  if (transactionItems.length > 0) return transactionItems
  return directItems
}

function getDashboardTokensFromBalances(tokens: PodsBalanceSection | undefined, preferences: WorkshopPreferences): DashboardTokenItem[] {
  const positions = tokens?.positions ?? []
  return positions
    .map((token, index) => mapPodsTokenToDashboardItem(token, index, preferences))
    .sort((first, second) => second.amountInUSD - first.amountInUSD)
}

function getTransferAssetsFromBalances(
  tokens: PodsBalanceSection | undefined,
  options: { requirePositiveBalance: boolean },
): WalletTransferAsset[] {
  const positions = tokens?.positions ?? []
  return positions
    .map((token, index) => mapPodsTokenToTransferAsset(token, index, options))
    .filter((asset): asset is WalletTransferAsset => Boolean(asset))
    .sort((first, second) => {
      const usdDifference = second.balanceAmount * second.priceUsd - first.balanceAmount * first.priceUsd
      if (usdDifference !== 0) return usdDifference
      return second.balanceAmount - first.balanceAmount
    })
}

function getDepositTransferAssets(tokens?: PodsBalanceSection) {
  const assets = getTransferAssetsFromBalances(tokens, { requirePositiveBalance: false })
  const hasBaseUsdc = assets.some(
    (asset) => asset.tokenData.chainId === base.id && asset.tokenData.address.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase(),
  )

  if (hasBaseUsdc) return assets
  return [getDefaultReceiveAsset(), ...assets]
}

function getSelectedTransferAsset(assets: WalletTransferAsset[], selectedAssetId?: string) {
  if (selectedAssetId) {
    const selectedAsset = assets.find((asset) => asset.id === selectedAssetId)
    if (selectedAsset) return selectedAsset
  }

  return assets[0] ?? null
}

function mapPodsTokenToTransferAsset(
  token: PodsApiToken,
  index: number,
  options: { requirePositiveBalance: boolean },
): WalletTransferAsset | null {
  const balanceAmount = getTokenHumanizedAmount(token)
  if (options.requirePositiveBalance && balanceAmount <= 0) return null

  const symbol = getDisplayString(token.symbol, 'TOKEN').toUpperCase()
  const chainId = token.chainId
  if (!chainId) return null

  const address = getDisplayString(token.address, ZERO_ADDRESS)
  const decimals = token.decimals ?? 18
  const chain = chainMetadata[chainId]
  const priceUsd = toFiniteNumber(token.priceUSD ?? token.price)
  const logoURI = getOptionalString(token.logoURI) ?? getOptionalString(token.logoUrl) ?? null
  const id = getTransferAssetId({ address, chainId, symbol, fallback: String(index) })
  const network = {
    name: chain?.name ?? getChainFallbackName(chainId) ?? 'Network',
    iconUrl: chain?.logoUrl,
  }
  const selectedToken = {
    symbol,
    name: getDisplayString(token.name, symbol),
    logoURI,
  }
  const tokenData = {
    address,
    chainId,
    decimals,
    symbol,
    name: selectedToken.name,
    logoURI,
    priceInUSD: priceUsd,
  }
  const balanceDomain = {
    address,
    chainId,
    name: selectedToken.name,
    symbol,
    decimals,
    logoUrl: logoURI ?? '',
    priceUSD: String(priceUsd),
    amountBase: String(token.amountBase ?? ''),
    amountUI: formatPlainAmount(balanceAmount) || '0',
    amountHumanized: formatPlainAmount(balanceAmount) || '0',
    amountInUSD: String(balanceAmount * priceUsd),
    id,
  }

  return {
    id,
    token: selectedToken,
    network,
    tokenData,
    balanceDomain,
    formattedBalance: `${formatTokenAmount(token)} ${symbol}`,
    balanceAmount,
    priceUsd,
  }
}

function getDefaultReceiveAsset(): WalletTransferAsset {
  const chain = chainMetadata[base.id]
  const tokenName = getDisplayString(defaultReceiveToken.name, defaultReceiveToken.symbol)
  const tokenLogoUri = defaultReceiveToken.logoURI ?? null
  const id = getTransferAssetId({
    address: BASE_USDC_ADDRESS,
    chainId: base.id,
    symbol: defaultReceiveToken.symbol,
    fallback: 'default',
  })
  const tokenData = {
    address: BASE_USDC_ADDRESS,
    chainId: base.id,
    decimals: 6,
    symbol: defaultReceiveToken.symbol,
    name: tokenName,
    logoURI: tokenLogoUri,
    priceInUSD: 1,
  }
  const balanceDomain = {
    address: BASE_USDC_ADDRESS,
    chainId: base.id,
    name: tokenName,
    symbol: defaultReceiveToken.symbol,
    decimals: 6,
    logoUrl: tokenLogoUri ?? '',
    priceUSD: '1',
    amountBase: '0',
    amountUI: '0',
    amountHumanized: '0',
    amountInUSD: '0',
    id,
  }

  return {
    id,
    token: defaultReceiveToken,
    network: {
      ...defaultReceiveNetwork,
      name: chain?.name ?? defaultReceiveNetwork.name,
      iconUrl: chain?.logoUrl ?? defaultReceiveNetwork.iconUrl,
    },
    tokenData,
    balanceDomain,
    formattedBalance: '0 USDC',
    balanceAmount: 0,
    priceUsd: 1,
  }
}

function getTransferPickerState({
  assets,
  selectedAsset,
  activePickerNetwork,
  search,
  walletDataStatus,
  walletDataError,
  preferences,
}: {
  assets: WalletTransferAsset[]
  selectedAsset: WalletTransferAsset | null
  activePickerNetwork: NetworkOption | null
  search: string
  walletDataStatus: WalletDataStatus
  walletDataError?: string
  preferences: WorkshopPreferences
}) {
  const networks = getTransferPickerNetworks(assets, preferences)
  const selectedNetwork = getTransferPickerSelectedNetwork({
    networks,
    selectedAsset,
    activePickerNetwork,
  })
  const displayedTokens = getDisplayedPickerTokens({
    assets,
    selectedNetwork,
    search,
  })
  const status = getTransferPickerStatus({
    assets,
    displayedTokens,
    walletDataStatus,
    walletDataError,
  })

  return {
    networks,
    selectedNetwork,
    displayedTokens,
    status,
  }
}

function getTransferPickerNetworks(assets: WalletTransferAsset[], preferences: WorkshopPreferences): NetworkOption[] {
  const networkByChainId = new Map<number, { option: NetworkOption; totalUsd: number }>()

  for (const asset of assets) {
    const existingNetwork = networkByChainId.get(asset.tokenData.chainId)
    const nextTotalUsd = (existingNetwork?.totalUsd ?? 0) + asset.balanceAmount * asset.priceUsd

    networkByChainId.set(asset.tokenData.chainId, {
      option: {
        chainId: asset.tokenData.chainId,
        name: asset.network.name,
        iconUrl: asset.network.iconUrl,
        balanceUsd: formatCurrencyAmount(nextTotalUsd, preferences),
      },
      totalUsd: nextTotalUsd,
    })
  }

  return Array.from(networkByChainId.values())
    .sort((first, second) => second.totalUsd - first.totalUsd)
    .map(({ option }) => option)
}

function getTransferPickerSelectedNetwork({
  networks,
  selectedAsset,
  activePickerNetwork,
}: {
  networks: NetworkOption[]
  selectedAsset: WalletTransferAsset | null
  activePickerNetwork: NetworkOption | null
}) {
  if (activePickerNetwork && networks.some((network) => network.chainId === activePickerNetwork.chainId)) {
    return activePickerNetwork
  }

  if (selectedAsset) {
    const selectedNetwork = networks.find((network) => network.chainId === selectedAsset.tokenData.chainId)
    if (selectedNetwork) return selectedNetwork
  }

  return networks[0] ?? null
}

function getDisplayedPickerTokens({
  assets,
  selectedNetwork,
  search,
}: {
  assets: WalletTransferAsset[]
  selectedNetwork: NetworkOption | null
  search: string
}) {
  const normalizedSearch = search.trim().toLowerCase()

  return assets
    .filter((asset) => {
      const matchesNetwork = asset.tokenData.chainId === selectedNetwork?.chainId
      const matchesSearch =
        !normalizedSearch ||
        asset.tokenData.symbol.toLowerCase().includes(normalizedSearch) ||
        asset.tokenData.name.toLowerCase().includes(normalizedSearch)

      return matchesNetwork && matchesSearch
    })
    .map((asset) => asset.tokenData)
}

function getTransferPickerStatus({
  assets,
  displayedTokens,
  walletDataStatus,
  walletDataError,
}: {
  assets: WalletTransferAsset[]
  displayedTokens: TokenData[]
  walletDataStatus: WalletDataStatus
  walletDataError?: string
}): WalletTransferPickerStatus {
  if (assets.length === 0 && walletDataStatus === 'loading') return 'loading'
  if (assets.length === 0 && walletDataError) return 'error'
  if (displayedTokens.length === 0) return 'empty'
  return 'idle'
}

function getTransferPickerLabels(status: WalletTransferPickerStatus, walletDataError?: string) {
  if (status === 'loading') {
    return {
      ...transferPickerLabels,
      searchEmptyTitle: 'Loading assets',
      searchEmptyDescription: 'Fetching wallet balances from Pods.',
    }
  }

  if (status === 'error') {
    return {
      ...transferPickerLabels,
      searchEmptyTitle: 'Wallet assets unavailable',
      searchEmptyDescription: walletDataError ?? 'Try refreshing the wallet data.',
    }
  }

  return transferPickerLabels
}

function findTransferBalance(assets: WalletTransferAsset[], tokenData: TokenData) {
  return findTransferAssetByTokenData(assets, tokenData)?.balanceDomain
}

function findTransferAssetByTokenData(assets: WalletTransferAsset[], tokenData: TokenData) {
  return assets.find(
    (asset) =>
      asset.tokenData.chainId === tokenData.chainId &&
      asset.tokenData.address.toLowerCase() === tokenData.address.toLowerCase(),
  )
}

function getNetworkCountForAsset(assets: WalletTransferAsset[], selectedAsset: WalletTransferAsset | null) {
  if (!selectedAsset) return 0

  const networkIds = assets
    .filter((asset) => asset.tokenData.symbol === selectedAsset.tokenData.symbol)
    .map((asset) => asset.tokenData.chainId)

  return new Set(networkIds).size || 1
}

function getDepositWarningMessage(asset: WalletTransferAsset | null) {
  if (!asset) return 'Select an asset and supported EVM network before depositing.'
  return `Only send ${asset.token.name} on ${asset.network.name} to this smart wallet address.`
}

function formatPickerTokenAmount(amountUI: string, _priceUSD: number) {
  const amount = toFiniteNumber(amountUI)
  if (amount <= 0) return '0'
  return compactNumberFormatter.format(amount)
}

function getTransferAssetId({
  address,
  chainId,
  symbol,
  fallback,
}: {
  address: string
  chainId: number
  symbol: string
  fallback: string
}) {
  return `${symbol.toLowerCase()}-${chainId}-${address || fallback}`.toLowerCase()
}

function getSendAmountWarning({
  asset,
  amount,
}: {
  asset: WalletTransferAsset | null
  amount: number
}) {
  if (!asset) return null
  if (amount > asset.balanceAmount) return 'Amount exceeds available balance.'
  return null
}

function isSendSubmitDisabled({
  asset,
  amount,
  destinationAddress,
}: {
  asset: WalletTransferAsset | null
  amount: number
  destinationAddress: string
}) {
  const trimmedDestination = destinationAddress.trim()

  if (!asset) return true
  if (amount <= 0) return true
  if (amount > asset.balanceAmount) return true
  if (!trimmedDestination) return true
  return !isAddress(trimmedDestination)
}

function getSendDetails(asset: WalletTransferAsset | null, amount: string): WalletOnchainWithdrawDetails | null {
  if (!asset) return null

  const amountValue = toFiniteNumber(amount)
  if (amountValue <= 0) return null

  const formattedAmount = `${formatPlainAmount(amountValue)} ${asset.token.symbol}`

  return {
    amount: formattedAmount,
    fee: '$0.00',
    receive: formattedAmount,
  }
}

function getTransferCall(asset: WalletTransferAsset, destinationAddress: Address, amount: bigint) {
  const tokenAddress = normalizeEvmAddress(asset.tokenData.address)
  if (!tokenAddress || tokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return {
      to: destinationAddress,
      value: amount,
    }
  }

  return {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: erc20TransferAbi,
      functionName: 'transfer',
      args: [destinationAddress, amount],
    }),
    value: 0n,
  }
}

function mapPodsTokenToDashboardItem(
  token: PodsApiToken,
  index: number,
  preferences: WorkshopPreferences,
): DashboardTokenItem {
  const symbol = getDisplayString(token.symbol, 'TOKEN').toUpperCase()
  const chain = token.chainId ? chainMetadata[token.chainId] : undefined
  const amountInUSD = toFiniteNumber(token.amountInUSD)
  const humanizedAmount = getTokenHumanizedAmount(token)
  const logoUrl = getOptionalString(token.logoURI) ?? getOptionalString(token.logoUrl) ?? ''
  const id = getOptionalString(token.id) ?? `${token.address ?? symbol}-${token.chainId ?? index}`
  const metadata: Record<string, unknown> = {
    color: getTokenColor(symbol),
    networkColor: chain?.color,
    group: isStableSymbol(symbol) ? 'stable' : 'crypto',
  }

  return {
    id,
    symbol,
    name: getDisplayString(token.name, symbol),
    logoUrl,
    networkLogoUrl: chain?.logoUrl,
    networkName: chain?.name ?? getChainFallbackName(token.chainId),
    formattedFiatValue: formatCurrencyAmount(amountInUSD, preferences),
    formattedAmount: formatTokenAmount(token),
    amountInUSD,
    humanizedAmount,
    isUpdating: false,
    metadata,
  }
}

function getWalletTotals(balances: PodsWalletBalances | undefined, preferences: WorkshopPreferences) {
  const tokenTotal = getTokenTotal(balances?.tokens)
  const earnTotal = toFiniteNumber(balances?.earn?.summary?.totalUnderlyingBalanceUSD)
  const total = tokenTotal + earnTotal

  return {
    tokenTotal,
    earnTotal,
    total,
    formattedTokenTotal: formatCurrencyAmount(tokenTotal, preferences),
    formattedEarnTotal: formatCurrencyAmount(earnTotal, preferences),
    formattedTotal: formatCurrencyAmount(total, preferences),
  }
}

function getTokenTotal(tokens?: PodsBalanceSection) {
  const summaryTotal = toFiniteNumber(tokens?.summary?.totalAmountInUSD)
  if (summaryTotal > 0) return summaryTotal

  return (tokens?.positions ?? []).reduce((total, token) => total + toFiniteNumber(token.amountInUSD), 0)
}

function getHistoryDisplay(item: PodsHistoryItem, index: number) {
  const status = toTitleCase(getDisplayString(item.status, 'pending'))
  const date = formatHistoryDate(item.finishedAt ?? item.createdAt ?? item.initialDate)
  const txHash = getHistoryTxHash(item)
  const subtitleParts = [status, date, txHash].filter((part) => part.length > 0)

  return {
    id: getOptionalString(item.id) ?? `history-${index}`,
    title: toTitleCase(getDisplayString(item.type, 'Transaction')),
    subtitle: subtitleParts.join(' - '),
    amount: getHistoryAmount(item),
  }
}

function getHistoryAmount(item: PodsHistoryItem) {
  const assetOut = item.amounts?.assetOut
  const assetIn = item.amounts?.assetIn
  const amountRecord = assetOut ?? assetIn

  if (!amountRecord) return '-'

  const amount = getOptionalString(amountRecord.amountHumanized) ?? getOptionalString(amountRecord.amount)
  const token = isRecord(amountRecord.token) ? amountRecord.token : undefined
  const symbol = getOptionalString(token?.symbol) ?? getOptionalString(amountRecord.currency)

  if (amount && symbol) return `${amount} ${symbol}`
  if (amount) return amount
  if (symbol) return symbol
  return '-'
}

function getHistoryTxHash(item: PodsHistoryItem) {
  const transaction = item.transactions?.find((candidate) => Boolean(getOptionalString(candidate.txHash)))
  const txHash = getOptionalString(transaction?.txHash) ?? getOptionalString(item.detail?.txHash)
  if (!txHash) return ''
  return formatAddress(txHash)
}

function formatHistoryDate(value?: string) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatTokenAmount(token: PodsApiToken) {
  const amount = token.humanized ?? token.amountHumanized ?? token.amountUI
  const numericAmount = toFiniteNumber(amount)

  if (!amount) return '0'
  if (numericAmount === 0 && amount !== '0') return amount
  return compactNumberFormatter.format(numericAmount)
}

function getTokenHumanizedAmount(token: PodsApiToken) {
  return toFiniteNumber(token.humanized ?? token.amountHumanized ?? token.amountUI)
}

function formatCurrencyAmount(valueInUsd: number, preferences: WorkshopPreferences) {
  const convertedValue = preferences.currency === 'BRL' ? valueInUsd * preferences.usdToBrlRate : valueInUsd
  const safeValue = Number.isFinite(convertedValue) ? convertedValue : 0
  return currencyFormatters[preferences.currency].format(safeValue)
}

function loadWorkshopPreferences(): WorkshopPreferences {
  if (typeof window === 'undefined') return defaultWorkshopPreferences

  try {
    const storedPreferences = window.localStorage.getItem(WORKSHOP_PREFERENCES_STORAGE_KEY)
    if (!storedPreferences) return defaultWorkshopPreferences
    return normalizeWorkshopPreferences(JSON.parse(storedPreferences))
  } catch {
    return defaultWorkshopPreferences
  }
}

function saveWorkshopPreferences(preferences: WorkshopPreferences) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WORKSHOP_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

function normalizeWorkshopPreferences(value: unknown): WorkshopPreferences {
  if (!isRecord(value)) return defaultWorkshopPreferences

  const language = value.language === 'PT' ? 'PT' : defaultWorkshopPreferences.language
  const currency = value.currency === 'BRL' ? 'BRL' : defaultWorkshopPreferences.currency

  return {
    language,
    currency,
    usdToBrlRate: normalizeUsdToBrlRate(value.usdToBrlRate),
  }
}

function normalizeUsdToBrlRate(value: unknown) {
  const rate = toFiniteNumber(value)
  if (rate <= 0) return DEFAULT_USD_TO_BRL_RATE
  return Number(rate.toFixed(4))
}

function formatPlainAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ''
  return value.toLocaleString('en-US', {
    maximumFractionDigits: 6,
    useGrouping: false,
  })
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0

  const normalized = value.replace(/[$,\s]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function getDisplayString(value: unknown, fallback: string) {
  return getOptionalString(value) ?? fallback
}

function getOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function getRecordArray(value: unknown): PodsHistoryItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord) as PodsHistoryItem[]
}

function getChainFallbackName(chainId?: number) {
  if (!chainId) return undefined
  return chainMetadata[chainId]?.name ?? `Chain ${chainId}`
}

function getTokenColor(symbol: string) {
  switch (symbol) {
    case 'USDC':
      return '#2775CA'
    case 'USDT':
      return '#26A17B'
    case 'ETH':
    case 'WETH':
      return '#627EEA'
    case 'BTC':
    case 'WBTC':
      return '#F7931A'
    default:
      return '#6f86d9'
  }
}

function getDashboardTokenColor(token: DashboardTokenItem) {
  const metadataColor = isRecord(token.metadata) ? getOptionalString(token.metadata.color) : undefined
  return metadataColor ?? getTokenColor(token.symbol)
}

function isStableSymbol(symbol: string) {
  return ['USDC', 'USDT', 'DAI', 'USDS', 'EURC', 'BRLA'].includes(symbol.toUpperCase())
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error
  if (!isRecord(error)) return 'Unknown error'
  const message = error.message
  return typeof message === 'string' ? message : 'Unknown error'
}

function normalizeBytecodeChainId(chainId: unknown) {
  if (typeof chainId === 'number' && Number.isInteger(chainId)) return chainId
  if (typeof chainId !== 'string') return undefined

  const parsedChainId = Number(chainId)
  return Number.isInteger(parsedChainId) ? parsedChainId : undefined
}

function getSupportedChainById(chainId: number) {
  return supportedChains.find((chain) => chain.id === chainId)
}

function getRpcUrlForChain(chain: Chain) {
  return rpcUrlOverrides[chain.id] ?? chain.rpcUrls.default.http[0]
}

function isUserRejectedError(message: string) {
  const normalizedMessage = message.toLowerCase()
  return normalizedMessage.includes('rejected') || normalizedMessage.includes('denied') || normalizedMessage.includes('cancel')
}

function formatTxEvent(event: TxUpdateEvent) {
  const txHash = 'txHash' in event && event.txHash ? ` ${event.txHash.slice(0, 10)}...` : ''
  const code = 'code' in event && event.code ? ` ${event.code}` : ''
  return `${event.type}${txHash}${code}`
}

function normalizeEvmAddress(address?: string): Address | undefined {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return undefined
  }
  return address as Address
}

function formatAddress(address?: string) {
  if (!address) return 'Not ready'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default App
````

<!-- file: src/style.css -->
````css
:root {
  color-scheme: light;
  font-family:
    Satoshi, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  color: #111827;
  background: #eef2ff;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    radial-gradient(circle at 10% 8%, rgba(109, 124, 255, 0.14), transparent 28%),
    radial-gradient(circle at 86% 16%, rgba(80, 98, 245, 0.12), transparent 30%),
    #eef2ff;
}

button,
select,
input {
  font: inherit;
}

button {
  -webkit-tap-highlight-color: transparent;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.app-shell {
  --color-bg-default: #f6f8ff;
  --color-bg-subtle: #eef2ff;
  --color-bg-muted: #e4e9ff;
  --color-bg-raised: #ffffff;
  --color-text-primary: #111827;
  --color-text-secondary: #647084;
  --color-text-tertiary: #98a2b3;
  --color-border-default: #d8def5;
  --color-border-secondary: #c8d1ee;
  --color-brand-primary: #6d7cff;
  --deframe-widget-font-family:
    Satoshi, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  --deframe-widget-font-size-xs: 11px;
  --deframe-widget-font-size-sm: 13px;
  --deframe-widget-font-size-md: 15px;
  --deframe-widget-font-size-lg: 18px;
  --deframe-widget-font-size-xl: 24px;
  --deframe-widget-font-size-xxl: 34px;
  --deframe-widget-font-weight-medium: 500;
  --deframe-widget-font-weight-semibold: 600;
  --deframe-widget-font-weight-bold: 700;
  --deframe-widget-color-brand-primary: #6d7cff;
  --deframe-widget-color-brand-secondary: #5062f5;
  --deframe-widget-color-brand-tertiary: #1f2a7a;
  --deframe-widget-color-brand-tint: #edf0ff;
  --deframe-widget-color-bg-primary: #f6f8ff;
  --deframe-widget-color-bg-default: #f6f8ff;
  --deframe-widget-color-bg-secondary: #ffffff;
  --deframe-widget-color-bg-subtle: #eef2ff;
  --deframe-widget-color-bg-tertiary: #e4e9ff;
  --deframe-widget-color-bg-muted: #e4e9ff;
  --deframe-widget-color-bg-raised: #ffffff;
  --deframe-widget-color-text-primary: #111827;
  --deframe-widget-color-text-secondary: #647084;
  --deframe-widget-color-text-tertiary: #98a2b3;
  --deframe-widget-color-text-disabled: #a8b1c2;
  --deframe-widget-color-placeholder-primary: #8f9bb0;
  --deframe-widget-color-border-default: #d8def5;
  --deframe-widget-color-border-primary: #d8def5;
  --deframe-widget-color-border-secondary: #c8d1ee;
  --deframe-widget-color-border-tertiary: rgba(17, 24, 39, 0.08);
  --deframe-widget-color-state-success: #6d7cff;
  --deframe-widget-color-state-warning: #d97706;
  --deframe-widget-color-state-error: #dc2626;
  --deframe-widget-color-state-info: #2563eb;
  --deframe-widget-size-gap-xs: 4px;
  --deframe-widget-size-gap-sm: 8px;
  --deframe-widget-size-gap-md: 16px;
  --deframe-widget-size-gap-lg: 24px;
  --deframe-widget-size-padding-x-sm: 12px;
  --deframe-widget-size-padding-x-md: 16px;
  --deframe-widget-size-padding-x-lg: 24px;
  --deframe-widget-size-padding-y-md: 16px;
  --deframe-widget-size-radius-sm: 8px;
  --deframe-widget-size-radius-md: 8px;
  --deframe-widget-size-radius-lg: 12px;
  --deframe-widget-size-radius-xl: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 18px;
  color: #111827;
  background: transparent;
}

.phone-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 650px;
  max-width: 100%;
  min-height: min(780px, calc(100vh - 36px));
  max-height: calc(100vh - 36px);
  overflow: hidden;
  border: 1px solid rgba(216, 222, 245, 0.86);
  border-radius: 42px;
  color: #111827;
  background: #ffffff;
  box-shadow: 0 22px 56px rgba(25, 33, 66, 0.16);
}

.phone-header {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 46px;
  align-items: center;
  gap: 10px;
  padding: 38px 28px 20px;
}

.phone-header h1 {
  margin: 0;
  color: #111827;
  font-size: 24px;
  font-weight: 850;
  line-height: 1;
  text-align: center;
  letter-spacing: 0;
}

.phone-header-button,
.phone-avatar-button,
.phone-search-button {
  display: grid;
  place-items: center;
  border: 1px solid #d8def5;
  border-radius: 14px;
  color: #25304d;
  background: #f8faff;
  cursor: pointer;
}

.phone-header-button,
.phone-avatar-button {
  width: 38px;
  height: 38px;
}

.phone-header-button svg,
.phone-avatar-button svg {
  width: 22px;
  height: 22px;
}

.phone-avatar-button {
  justify-self: end;
  color: #5062f5;
  border-color: #c8d1ff;
  background: #eef2ff;
}

.phone-avatar-button:disabled,
.smart-address-chip:disabled,
.phone-search-button:disabled,
.primary-button:disabled,
.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.phone-content {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 28px 88px;
}

.notice-stack {
  display: grid;
  gap: 10px;
}

.phone-notice-stack {
  margin: 0 28px 14px;
}

.notice-band {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #d8def5;
  border-radius: 14px;
  color: #36415f;
  background: #f8faff;
  font-size: 13px;
  font-weight: 700;
}

.phone-notice-stack .notice-band {
  align-items: flex-start;
  flex-direction: column;
  margin: 0;
}

.notice-band.warning {
  color: #92400e;
  border-color: #fed7aa;
  background: #fff7ed;
}

.phone-overview {
  display: grid;
  gap: 26px;
}

.phone-balance-panel {
  display: grid;
  gap: 9px;
  padding-top: 12px;
}

.phone-balance-topline,
.phone-balance-row,
.phone-action-bar,
.phone-assets-heading,
.smart-address-chip,
.currency-selector,
.phone-action-pill,
.phone-swap-button,
.phone-bottom-nav,
.phone-nav-item,
.phone-asset-row,
.primary-button,
.secondary-button,
.section-heading,
.route-chip,
.history-list li,
.log-list li {
  display: flex;
  align-items: center;
}

.phone-balance-topline {
  justify-content: space-between;
  gap: 12px;
}

.phone-balance-topline > span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #647084;
  font-size: 18px;
  font-weight: 500;
}

.phone-balance-topline svg {
  width: 18px;
  height: 18px;
}

.currency-selector {
  position: relative;
  gap: 4px;
  border: 0;
  color: #5062f5;
  background: transparent;
  font-size: 16px;
  font-weight: 850;
  cursor: pointer;
}

.currency-selector select {
  position: relative;
  z-index: 1;
  max-width: 72px;
  padding: 0 20px 0 0;
  border: 0;
  outline: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  font-weight: inherit;
  appearance: none;
  cursor: pointer;
}

.currency-selector svg {
  position: absolute;
  right: 0;
  width: 18px;
  height: 18px;
  pointer-events: none;
}

.phone-balance-row {
  justify-content: space-between;
  gap: 16px;
}

.phone-balance-row strong {
  min-width: 0;
  overflow: hidden;
  color: #5062f5;
  font-size: clamp(36px, 10vw, 46px);
  font-weight: 900;
  line-height: 0.98;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone-balance-row span {
  flex: 0 0 auto;
  color: #5f6df0;
  font-size: 14px;
  font-weight: 750;
}

.smart-address-chip {
  width: fit-content;
  max-width: 100%;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid #c8d1ff;
  border-radius: 999px;
  color: #5062f5;
  background: #eef2ff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.phone-action-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 58px minmax(0, 1fr);
  align-items: center;
  margin-top: 4px;
}

.phone-action-pill {
  position: relative;
  z-index: 0;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  height: 58px;
  border: 0;
  border-radius: 999px;
  color: #ffffff;
  background: #111827;
  font-size: 17px;
  font-weight: 850;
  white-space: nowrap;
  cursor: pointer;
}

.phone-action-pill svg {
  width: 24px;
  height: 24px;
}

.phone-action-pill:first-child {
  grid-column: 1 / 3;
  grid-row: 1;
  padding: 0 62px 0 20px;
}

.phone-action-pill:last-child {
  grid-column: 2 / 4;
  grid-row: 1;
  padding: 0 18px 0 62px;
}

.phone-swap-button {
  z-index: 1;
  grid-column: 2;
  grid-row: 1;
  justify-self: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  border: 5px solid #ffffff;
  border-radius: 50%;
  color: #ffffff;
  background: #6d7cff;
  cursor: pointer;
}

.phone-swap-button svg {
  width: 24px;
  height: 24px;
}

.phone-assets-section {
  display: grid;
  gap: 16px;
}

.phone-assets-heading {
  justify-content: space-between;
  gap: 16px;
}

.phone-assets-heading h2 {
  margin: 0;
  color: #111827;
  font-size: 25px;
  font-weight: 850;
  letter-spacing: 0;
}

.phone-search-button {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.phone-search-button svg {
  width: 22px;
  height: 22px;
}

.phone-search-button:disabled {
  cursor: progress;
}

.phone-asset-list,
.history-list,
.log-list {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.phone-asset-row {
  gap: 14px;
  min-width: 0;
  min-height: 78px;
  padding: 14px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  background: #f8faff;
}

.phone-token-icon {
  display: grid;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  color: #ffffff;
  font-size: 19px;
  font-weight: 900;
}

.phone-token-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.phone-token-copy,
.phone-token-value {
  display: grid;
  min-width: 0;
}

.phone-token-copy {
  gap: 4px;
  flex: 1;
}

.phone-token-copy strong,
.phone-token-value strong {
  overflow: hidden;
  color: #111827;
  font-size: 18px;
  font-weight: 850;
  line-height: 1.08;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone-token-copy span {
  overflow: hidden;
  color: #647084;
  font-size: 13px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone-token-value {
  justify-items: end;
  gap: 4px;
  flex: 0 1 104px;
}

.phone-token-value span {
  max-width: 104px;
  overflow: hidden;
  color: #5062f5;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.1;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone-muted-copy,
.phone-error-copy,
.phone-empty-assets,
.muted-copy {
  margin: 0;
  color: #647084;
  font-size: 13px;
}

.phone-error-copy {
  color: #dc2626;
}

.phone-empty-assets,
.empty-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 26px 18px;
  border: 1px solid #e2e8f0;
  border-radius: 22px;
  color: #647084;
  background: #f8faff;
  text-align: center;
}

.phone-empty-assets strong,
.empty-state h2 {
  margin: 0;
  color: #111827;
  font-size: 16px;
}

.phone-bottom-nav {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  justify-content: space-around;
  height: 74px;
  padding: 0 24px 12px;
  border-radius: 0 0 34px 34px;
  background: #f8faff;
  box-shadow: 0 -12px 34px rgba(25, 33, 66, 0.08);
}

.phone-nav-item {
  position: relative;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  color: #4f5a73;
  background: transparent;
  cursor: pointer;
}

.phone-nav-item svg {
  width: 21px;
  height: 21px;
}

.phone-nav-item.active {
  width: 58px;
  height: 58px;
  margin-top: -30px;
  border: 4px solid #ffffff;
  color: #ffffff;
  background: #6d7cff;
}

.workshop-widget-page,
.workshop-widget-container,
.wallet-transfer-view,
.activity-panel,
.empty-state {
  max-width: none;
  min-height: auto;
  border: 0;
  background: transparent;
}

.workshop-widget-page,
.workshop-widget-container {
  border-radius: 0;
}

.wallet-transfer-view,
.activity-panel,
.empty-state {
  padding: 0;
}

.wallet-transfer-view,
.workshop-widget-page,
.workshop-widget-container {
  color: #111827;
}

.wallet-transfer-view :where(input, textarea, select),
.workshop-widget-container :where(input, textarea, select) {
  color: #111827;
  border-color: #d8def5;
  background: #ffffff;
}

.wallet-transfer-view :where(button),
.workshop-widget-container :where(button) {
  border-radius: 8px;
}

.section-heading {
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
  color: #5062f5;
}

.section-heading h2,
.activity-section h3 {
  margin: 0;
  color: #111827;
}

.activity-panel {
  display: grid;
  gap: 18px;
}

.preferences-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
  border: 1px solid #d8def5;
  border-radius: 16px;
  background: #f8faff;
}

.preference-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.preference-field span {
  color: #647084;
  font-size: 12px;
  font-weight: 800;
}

.preference-field select,
.preference-field input {
  width: 100%;
  min-width: 0;
  height: 38px;
  padding: 0 10px;
  border: 1px solid #d8def5;
  border-radius: 10px;
  outline: 0;
  color: #111827;
  background: #ffffff;
}

.preference-field select:focus,
.preference-field input:focus {
  border-color: #6d7cff;
  box-shadow: 0 0 0 3px rgba(109, 124, 255, 0.18);
}

.route-chip {
  width: fit-content;
  max-width: 100%;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid #c8d1ff;
  border-radius: 999px;
  color: #5062f5;
  background: #eef2ff;
  font-size: 12px;
  font-weight: 800;
}

.activity-section {
  display: grid;
  gap: 12px;
}

.history-list li,
.log-list li {
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8faff;
}

.history-list div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.history-list span,
.log-list li {
  color: #111827;
  font-weight: 750;
}

.history-list small {
  overflow: hidden;
  color: #647084;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-list strong {
  flex: 0 0 auto;
  color: #5062f5;
  white-space: nowrap;
}

.primary-button,
.secondary-button {
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
}

.primary-button {
  padding: 0 16px;
  border: 1px solid #6d7cff;
  color: #ffffff;
  background: #6d7cff;
}

.secondary-button {
  padding: 0 12px;
  border: 1px solid #c8d1ff;
  color: #5062f5;
  background: #eef2ff;
}

@media (max-width: 520px) {
  .app-shell {
    padding: 0;
  }

  .phone-screen {
    width: 100%;
    min-height: 100vh;
    max-height: none;
    border-radius: 0;
    box-shadow: none;
  }

  .phone-header {
    padding: 30px 24px 18px;
  }

  .phone-content {
    padding: 0 24px 86px;
  }

  .phone-notice-stack {
    margin-inline: 24px;
  }

  .phone-action-pill {
    height: 56px;
    font-size: 16px;
  }

  .phone-swap-button {
    width: 56px;
    height: 56px;
  }

  .phone-asset-row {
    min-height: 76px;
    padding: 14px 16px;
    border-radius: 22px;
  }

  .phone-token-icon {
    width: 44px;
    height: 44px;
  }

  .preferences-panel {
    grid-template-columns: 1fr;
  }

  .phone-bottom-nav {
    border-radius: 0;
  }
}

@media (max-width: 380px) {
  .phone-header,
  .phone-content {
    padding-inline: 20px;
  }

  .phone-notice-stack {
    margin-inline: 20px;
  }

  .phone-balance-topline > span {
    font-size: 17px;
  }

  .phone-action-bar {
    grid-template-columns: minmax(0, 1fr) 54px minmax(0, 1fr);
  }

  .phone-action-pill {
    gap: 7px;
    font-size: 14px;
  }

  .phone-action-pill svg {
    width: 22px;
    height: 22px;
  }

  .phone-action-pill:first-child {
    padding: 0 58px 0 16px;
  }

  .phone-action-pill:last-child {
    padding: 0 12px 0 58px;
  }

  .phone-swap-button {
    width: 54px;
    height: 54px;
    border-width: 5px;
  }
}
````

<!-- file: src/vite-env.d.ts -->
````ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_PODS_URL?: string
  readonly NEXT_PUBLIC_PODS_API_KEY?: string
  readonly NEXT_PUBLIC_PODS_WEBSOCKET_URL?: string
  readonly NEXT_PUBLIC_PRIVY_APP_ID?: string
  readonly NEXT_PUBLIC_BASE_RPC_URL?: string
  readonly NEXT_PUBLIC_POLYGON_RPC_URL?: string
  readonly NEXT_PUBLIC_ARBITRUM_RPC_URL?: string
  readonly NEXT_PUBLIC_OPTIMISM_RPC_URL?: string
  readonly NEXT_PUBLIC_ETHEREUM_RPC_URL?: string
  readonly NEXT_PUBLIC_BSC_RPC_URL?: string
  readonly NEXT_PUBLIC_GNOSIS_RPC_URL?: string
  readonly NEXT_PUBLIC_AVALANCHE_RPC_URL?: string
  readonly NEXT_PUBLIC_ZKSYNC_RPC_URL?: string
  readonly NEXT_PUBLIC_LINEA_RPC_URL?: string
  readonly NEXT_PUBLIC_CELO_RPC_URL?: string
  readonly NEXT_PUBLIC_HYPEREVM_RPC_URL?: string
  readonly NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
````

<!-- file: src/shims/next-link.tsx -->
````tsx
import type { AnchorHTMLAttributes, PropsWithChildren } from 'react'

type NextLinkShimProps = PropsWithChildren<
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>

export default function Link({ href, children, ...props }: NextLinkShimProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
}
````

<!-- file: README.md -->
````md
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
````

<!-- file: LICENSE -->
````text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS
````
