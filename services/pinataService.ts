// XU Wallet — Pinata IPFS service (env-key first, AsyncStorage fallback)
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENV_PINATA_API_KEY = process.env.EXPO_PUBLIC_PINATA_API_KEY ?? '';
const ENV_PINATA_SECRET = process.env.EXPO_PUBLIC_PINATA_SECRET ?? '';

const PINATA_API_KEY_STORAGE = 'xu_pinata_api_key';
const PINATA_SECRET_STORAGE = 'xu_pinata_secret';

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
];

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
  contractAddress: string;
  network: string;
  chainId?: number;
  description?: string;
  color?: string;
  logoUrl?: string;
  creatorWallet?: string;
  website?: string;
  createdAt?: string;
}

// ── Resolve ipfs:// or bare CID to an HTTP URL ─────────────────────────────────

export function resolveIpfsUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '');
    return `${IPFS_GATEWAYS[0]}${cid}`;
  }
  // Bare CID
  if (url.length > 20 && !url.includes('/')) {
    return `${IPFS_GATEWAYS[0]}${url}`;
  }
  return url;
}

// ── Credential resolution ──────────────────────────────────────────────────────

export async function getPinataCredentials(): Promise<{ apiKey: string; secretKey: string } | null> {
  if (ENV_PINATA_API_KEY && ENV_PINATA_SECRET) {
    return { apiKey: ENV_PINATA_API_KEY, secretKey: ENV_PINATA_SECRET };
  }
  const apiKey = await AsyncStorage.getItem(PINATA_API_KEY_STORAGE);
  const secretKey = await AsyncStorage.getItem(PINATA_SECRET_STORAGE);
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

export async function savePinataCredentials(apiKey: string, secretKey: string): Promise<void> {
  await AsyncStorage.setItem(PINATA_API_KEY_STORAGE, apiKey);
  await AsyncStorage.setItem(PINATA_SECRET_STORAGE, secretKey);
}

export async function hasPinataCredentials(): Promise<boolean> {
  if (ENV_PINATA_API_KEY && ENV_PINATA_SECRET) return true;
  const creds = await getPinataCredentials();
  return creds !== null;
}

export function isPinataConfiguredViaEnv(): boolean {
  return !!(ENV_PINATA_API_KEY && ENV_PINATA_SECRET);
}

// ── Fetch metadata JSON from a CID or URL ─────────────────────────────────────

export async function fetchTokenMetadataFromPinata(cidOrUrl: string): Promise<TokenMetadata> {
  const url = resolveIpfsUrl(cidOrUrl) ?? cidOrUrl;

  const creds = await getPinataCredentials();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (creds) {
    headers['pinata_api_key'] = creds.apiKey;
    headers['pinata_secret_api_key'] = creds.secretKey;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch from Pinata: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.symbol || !data.name || !data.contractAddress) {
    throw new Error('Invalid token metadata: missing required fields (name, symbol, contractAddress)');
  }

  return {
    name: String(data.name),
    symbol: String(data.symbol).toUpperCase(),
    decimals: Number(data.decimals ?? 18),
    totalSupply: data.totalSupply ? String(data.totalSupply) : undefined,
    contractAddress: String(data.contractAddress),
    network: String(data.network ?? data.chain ?? 'ethereum').toLowerCase(),
    chainId: data.chainId ? Number(data.chainId) : undefined,
    description: data.description ? String(data.description) : undefined,
    color: data.color ?? '#E8B800',
    logoUrl: resolveIpfsUrl(data.logoUrl ?? data.logo ?? data.image),
    creatorWallet: data.creatorWallet ?? data.owner ?? undefined,
    website: data.website ?? undefined,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

// ── Authenticated search ───────────────────────────────────────────────────────

export async function searchPinataTokens(keyword: string): Promise<TokenMetadata[]> {
  const creds = await getPinataCredentials();
  if (!creds) throw new Error('Pinata credentials not configured');

  const response = await fetch(
    `https://api.pinata.cloud/data/pinList?status=pinned&metadata[name]=${encodeURIComponent(keyword)}&pageLimit=10`,
    {
      headers: {
        pinata_api_key: creds.apiKey,
        pinata_secret_api_key: creds.secretKey,
      },
    }
  );

  if (!response.ok) throw new Error(`Pinata API error: ${response.status}`);

  const result = await response.json();
  const rows: any[] = result.rows ?? [];
  const metadataResults: TokenMetadata[] = [];
  for (const row of rows) {
    try {
      const meta = await fetchTokenMetadataFromPinata(row.ipfs_pin_hash);
      metadataResults.push(meta);
    } catch { /* skip invalid */ }
  }
  return metadataResults;
}
