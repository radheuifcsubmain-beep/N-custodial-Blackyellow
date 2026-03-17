// XU Wallet — Auto-fetch token metadata pipeline
// Priority: Supabase → Etherscan API → Pinata IPFS → RPC eth_call
import { NETWORKS, NetworkId, EXPLORER_API_KEYS } from '../constants/config';
import { TokenMetadata } from './pinataService';
import { fetchTokenMetadataFromChain } from './tokenContractService';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const PINATA_API_KEY = process.env.EXPO_PUBLIC_PINATA_API_KEY ?? '';
const PINATA_SECRET = process.env.EXPO_PUBLIC_PINATA_SECRET ?? '';

export type FetchSource = 'supabase' | 'pinata' | 'etherscan' | 'rpc';

export interface TokenImportResult {
  metadata: TokenMetadata;
  source: FetchSource;
}

export function sourceLabelFor(source: FetchSource): string {
  switch (source) {
    case 'supabase': return 'Supabase DB';
    case 'pinata': return 'Pinata IPFS';
    case 'etherscan': return 'Etherscan API';
    case 'rpc': return 'Blockchain RPC';
  }
}

// ── Step 1: Supabase ─────────────────────────────────────────────────────────

async function fetchFromSupabase(
  contractAddress: string,
  networkId: NetworkId
): Promise<TokenImportResult | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/tokens` +
      `?contract_address=eq.${contractAddress.toLowerCase()}` +
      `&network=eq.${networkId}` +
      `&select=*&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const row = rows[0];

    // If there's a Pinata CID, fetch richer metadata from IPFS
    if (row.pinata_cid) {
      const pinataResult = await fetchFromPinataCid(row.pinata_cid);
      if (pinataResult) return { metadata: pinataResult.metadata, source: 'supabase' };
    }

    if (!row.name || !row.symbol) return null;

    return {
      source: 'supabase',
      metadata: {
        name: String(row.name),
        symbol: String(row.symbol).toUpperCase(),
        decimals: Number(row.decimals ?? 18),
        contractAddress: String(row.contract_address ?? contractAddress),
        network: String(row.network ?? networkId),
        chainId: row.chain_id ? Number(row.chain_id) : NETWORKS[networkId]?.chainId,
        totalSupply: row.total_supply ? String(row.total_supply) : undefined,
        description: row.description ?? undefined,
        color: row.color ?? '#E8B800',
        logoUrl: row.logo_url ?? undefined,
        creatorWallet: row.creator_wallet ?? undefined,
        website: row.website ?? undefined,
        createdAt: row.created_at ?? new Date().toISOString(),
      },
    };
  } catch (err) {
    console.log('[TokenImport] Supabase lookup error:', err);
    return null;
  }
}

// ── Step 2: Etherscan token info API ─────────────────────────────────────────

async function fetchFromEtherscan(
  contractAddress: string,
  networkId: Exclude<NetworkId, 'solana'>
): Promise<TokenImportResult | null> {
  const network = NETWORKS[networkId];
  if (!network.explorerApiUrl) return null;

  const apiKey = networkId === 'ethereum'
    ? EXPLORER_API_KEYS.etherscan
    : networkId === 'bsc'
    ? EXPLORER_API_KEYS.bscscan
    : EXPLORER_API_KEYS.polygonscan;

  if (!apiKey) return null;

  try {
    const url =
      `${network.explorerApiUrl}?module=token&action=tokeninfo` +
      `&contractaddress=${contractAddress}&apikey=${apiKey}`;

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.result) || data.result.length === 0) {
      return null;
    }

    const info = data.result[0];
    if (!info.tokenName || !info.symbol) return null;

    return {
      source: 'etherscan',
      metadata: {
        name: String(info.tokenName),
        symbol: String(info.symbol).toUpperCase(),
        decimals: Number(info.divisor ?? info.decimals ?? 18),
        totalSupply: info.totalSupply ?? undefined,
        contractAddress,
        network: networkId,
        chainId: network.chainId,
        description: info.description ?? undefined,
        color: '#E8B800',
        website: info.website ?? undefined,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.log('[TokenImport] Etherscan error:', err);
    return null;
  }
}

// ── Step 3: Pinata by CID ─────────────────────────────────────────────────────

export async function fetchFromPinataCid(cid: string): Promise<TokenImportResult | null> {
  try {
    const url = cid.startsWith('http')
      ? cid
      : cid.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${cid.replace('ipfs://', '')}`
      : `https://gateway.pinata.cloud/ipfs/${cid}`;

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (PINATA_API_KEY) headers['pinata_api_key'] = PINATA_API_KEY;
    if (PINATA_SECRET) headers['pinata_secret_api_key'] = PINATA_SECRET;

    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.symbol || !data.name || !data.contractAddress) return null;

    return {
      source: 'pinata',
      metadata: {
        name: String(data.name),
        symbol: String(data.symbol).toUpperCase(),
        decimals: Number(data.decimals ?? 18),
        totalSupply: data.totalSupply ? String(data.totalSupply) : undefined,
        contractAddress: String(data.contractAddress),
        network: String(data.network ?? data.chain ?? 'ethereum').toLowerCase(),
        chainId: data.chainId ? Number(data.chainId) : undefined,
        description: data.description ?? undefined,
        color: data.color ?? '#E8B800',
        logoUrl: data.logoUrl ?? data.image ?? undefined,
        creatorWallet: data.creatorWallet ?? data.owner ?? undefined,
        website: data.website ?? undefined,
        createdAt: data.createdAt ?? new Date().toISOString(),
      },
    };
  } catch {
    return null;
  }
}

// ── Step 4: Blockchain RPC (always works) ────────────────────────────────────

async function fetchFromRPC(
  contractAddress: string,
  networkId: Exclude<NetworkId, 'solana'>
): Promise<TokenImportResult> {
  const metadata = await fetchTokenMetadataFromChain(contractAddress, networkId);
  return { metadata, source: 'rpc' };
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Auto-fetches token metadata using priority chain:
 * Supabase → Etherscan API → Pinata IPFS → RPC eth_call
 */
export async function autoFetchTokenMetadata(
  contractAddress: string,
  networkId: Exclude<NetworkId, 'solana'>
): Promise<TokenImportResult> {
  const addr = contractAddress.trim();

  const supabase = await fetchFromSupabase(addr, networkId);
  if (supabase) { console.log('[XU] Token found in Supabase'); return supabase; }

  const etherscan = await fetchFromEtherscan(addr, networkId);
  if (etherscan) { console.log('[XU] Token found via Etherscan'); return etherscan; }

  console.log('[XU] Falling back to blockchain RPC');
  return fetchFromRPC(addr, networkId);
}

/**
 * Fetch token metadata from a Pinata CID / IPFS URL
 */
export async function fetchTokenFromPinataCID(cidOrUrl: string): Promise<TokenImportResult> {
  const result = await fetchFromPinataCid(cidOrUrl);
  if (result) return result;
  throw new Error('Could not fetch token metadata from Pinata. Check the CID / URL.');
}
