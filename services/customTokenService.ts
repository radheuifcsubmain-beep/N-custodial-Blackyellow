// OnSpace Wallet — Custom token storage service
// Stores user-imported tokens per wallet address in AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TokenMetadata } from './pinataService';
import { NetworkId } from '../constants/config';

const CUSTOM_TOKENS_KEY = 'onspace_custom_tokens_v2';

export interface CustomToken {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: string;
  network: NetworkId;
  color: string;
  logoUrl?: string;
  description?: string;
  totalSupply?: string;
  creatorWallet?: string;
  isOwnToken: boolean; // true if the token was created by this wallet
  addedAt: string;
  pinataMetadata?: TokenMetadata;
}

function networkFromString(network: string): NetworkId {
  const lower = network.toLowerCase();
  if (lower.includes('bsc') || lower.includes('bnb') || lower.includes('binance')) return 'bsc';
  if (lower.includes('polygon') || lower.includes('matic')) return 'polygon';
  if (lower.includes('solana') || lower.includes('sol')) return 'solana';
  return 'ethereum';
}

export async function loadCustomTokens(): Promise<CustomToken[]> {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_TOKENS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as CustomToken[];
  } catch {
    return [];
  }
}

export async function saveCustomTokens(tokens: CustomToken[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
}

export async function addCustomToken(
  metadata: TokenMetadata,
  walletAddresses: Record<NetworkId, string>
): Promise<CustomToken> {
  const existing = await loadCustomTokens();

  const network = networkFromString(metadata.network);
  const walletAddr = walletAddresses[network]?.toLowerCase() ?? '';
  const creatorAddr = metadata.creatorWallet?.toLowerCase() ?? '';
  const isOwnToken = !!walletAddr && !!creatorAddr && walletAddr === creatorAddr;

  const newToken: CustomToken = {
    id: `${metadata.contractAddress}_${network}_${Date.now()}`,
    name: metadata.name,
    symbol: metadata.symbol,
    decimals: metadata.decimals,
    contractAddress: metadata.contractAddress,
    network,
    color: metadata.color ?? '#00D4FF',
    logoUrl: metadata.logoUrl,
    description: metadata.description,
    totalSupply: metadata.totalSupply,
    creatorWallet: metadata.creatorWallet,
    isOwnToken,
    addedAt: new Date().toISOString(),
    pinataMetadata: metadata,
  };

  // Deduplicate by contractAddress + network
  const filtered = existing.filter(
    t => !(t.contractAddress.toLowerCase() === metadata.contractAddress.toLowerCase() && t.network === network)
  );
  filtered.unshift(newToken);

  await saveCustomTokens(filtered);
  return newToken;
}

export async function removeCustomToken(tokenId: string): Promise<void> {
  const existing = await loadCustomTokens();
  const filtered = existing.filter(t => t.id !== tokenId);
  await saveCustomTokens(filtered);
}

export async function getCustomTokensForNetwork(
  network: NetworkId
): Promise<CustomToken[]> {
  const all = await loadCustomTokens();
  return all.filter(t => t.network === network);
}

// Fetch on-chain balance for a custom token via JSON-RPC
const BALANCE_OF_SELECTOR = '0x70a08231';

export async function fetchCustomTokenBalance(
  token: CustomToken,
  walletAddress: string,
  rpcUrl: string
): Promise<string> {
  try {
    const paddedAddr = walletAddress.toLowerCase().replace('0x', '').padStart(64, '0');
    const callData = BALANCE_OF_SELECTOR + paddedAddr;

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: token.contractAddress, data: callData }, 'latest'],
        id: 1,
      }),
    });
    const data = await response.json();
    const hex: string = data.result || '0x0';

    if (!hex || hex === '0x' || hex === '0x0') return '0.000000';
    const bigVal = BigInt(hex);
    const divisor = BigInt(10 ** token.decimals);
    const whole = bigVal / divisor;
    const remainder = bigVal % divisor;
    const fracStr = remainder.toString().padStart(token.decimals, '0').slice(0, 6);
    return `${whole}.${fracStr}`;
  } catch {
    return '0.000000';
  }
}
