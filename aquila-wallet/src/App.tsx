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
