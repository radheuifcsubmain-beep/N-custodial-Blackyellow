// Powered by OnSpace.AI
// ─── Network Configuration ────────────────────────────────────────────────────
export const DEFAULT_USE_TESTNETS = true;

const INFURA_KEY = process.env.EXPO_PUBLIC_INFURA_KEY ?? '';
export const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? '';

// ─── Mainnet Networks ──────────────────────────────────────────────────────────
export const MAINNET_NETWORKS = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    chainId: 1,
    rpcUrl: ALCHEMY_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    explorerUrl: 'https://etherscan.io',
    explorerApiUrl: 'https://api.etherscan.io/api',
    decimals: 18,
    color: '#627EEA',
    coinGeckoId: 'ethereum',
    isTestnet: false,
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    chainId: 56,
    rpcUrl: ALCHEMY_KEY
      ? `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : `https://bsc-mainnet.infura.io/v3/${INFURA_KEY}`,
    explorerUrl: 'https://bscscan.com',
    explorerApiUrl: 'https://api.bscscan.com/api',
    decimals: 18,
    color: '#F3BA2F',
    coinGeckoId: 'binancecoin',
    isTestnet: false,
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'POL',
    chainId: 137,
    rpcUrl: ALCHEMY_KEY
      ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
    explorerUrl: 'https://polygonscan.com',
    explorerApiUrl: 'https://api.polygonscan.com/api',
    decimals: 18,
    color: '#8247E5',
    coinGeckoId: 'matic-network',
    isTestnet: false,
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    chainId: 0,
    rpcUrl: ALCHEMY_KEY
      ? `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io',
    explorerApiUrl: '',
    decimals: 9,
    color: '#9945FF',
    coinGeckoId: 'solana',
    isTestnet: false,
  },
} as const;

// ─── Testnet Networks ──────────────────────────────────────────────────────────
export const TESTNET_NETWORKS = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    chainId: 11155111,
    rpcUrl: ALCHEMY_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerApiUrl: 'https://api-sepolia.etherscan.io/api',
    decimals: 18,
    color: '#627EEA',
    coinGeckoId: 'ethereum',
    isTestnet: true,
  },
  bsc: {
    id: 'bsc',
    name: 'BSC Testnet',
    symbol: 'BNB',
    chainId: 97,
    rpcUrl: ALCHEMY_KEY
      ? `https://bnb-testnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    explorerUrl: 'https://testnet.bscscan.com',
    explorerApiUrl: 'https://api-testnet.bscscan.com/api',
    decimals: 18,
    color: '#F3BA2F',
    coinGeckoId: 'binancecoin',
    isTestnet: true,
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon Amoy',
    symbol: 'POL',
    chainId: 80002,
    rpcUrl: ALCHEMY_KEY
      ? `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : 'https://rpc-amoy.polygon.technology',
    explorerUrl: 'https://amoy.polygonscan.com',
    explorerApiUrl: 'https://api-amoy.polygonscan.com/api',
    decimals: 18,
    color: '#8247E5',
    coinGeckoId: 'matic-network',
    isTestnet: true,
  },
  solana: {
    id: 'solana',
    name: 'Solana Devnet',
    symbol: 'SOL',
    chainId: 0,
    rpcUrl: ALCHEMY_KEY
      ? `https://solana-devnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : 'https://api.devnet.solana.com',
    explorerUrl: 'https://solscan.io/?cluster=devnet',
    explorerApiUrl: '',
    decimals: 9,
    color: '#9945FF',
    coinGeckoId: 'solana',
    isTestnet: true,
  },
} as const;

export function getNetworks(isTestnet: boolean) {
  return isTestnet ? TESTNET_NETWORKS : MAINNET_NETWORKS;
}

// Default active networks (used by services that can't access context)
export const NETWORKS = DEFAULT_USE_TESTNETS ? TESTNET_NETWORKS : MAINNET_NETWORKS;

export type NetworkId = keyof typeof MAINNET_NETWORKS;

export const DERIVATION_PATHS: Record<string, string> = {
  ethereum: "m/44'/60'/0'/0/0",
  bsc: "m/44'/60'/0'/0/0",
  polygon: "m/44'/60'/0'/0/0",
  solana: "m/44'/501'/0'/0'",
};

export const STORAGE_KEYS = {
  ENCRYPTED_WALLET: 'nw_encrypted_wallet',
  WALLET_ADDRESS: 'nw_wallet_addresses',
  SELECTED_NETWORK: 'nw_selected_network',
  HAS_WALLET: 'nw_has_wallet',
  IS_TESTNET: 'nw_is_testnet',
};

export const EXPLORER_API_KEYS = {
  etherscan: process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY ?? '',
  bscscan: process.env.EXPO_PUBLIC_BSCSCAN_API_KEY ?? '',
  polygonscan: process.env.EXPO_PUBLIC_POLYGONSCAN_API_KEY ?? '',
};

// Legacy flag for components that haven't migrated to dynamic toggle
export const USE_TESTNETS = DEFAULT_USE_TESTNETS;
