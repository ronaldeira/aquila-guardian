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
