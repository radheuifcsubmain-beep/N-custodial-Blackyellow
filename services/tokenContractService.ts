// OnSpace Wallet — Fetch ERC-20/BEP-20 token metadata directly from blockchain
import { NETWORKS, NetworkId } from '../constants/config';
import { TokenMetadata } from './pinataService';

// ERC-20 function selectors
const SEL_NAME = '0x06fdde03';
const SEL_SYMBOL = '0x95d89b41';
const SEL_DECIMALS = '0x313ce567';
const SEL_TOTAL_SUPPLY = '0x18160ddd';

function decodeString(hex: string): string {
  try {
    if (!hex || hex === '0x') return '';
    // ABI-encoded string: offset (32 bytes) + length (32 bytes) + data
    const clean = hex.slice(2);
    if (clean.length < 128) return '';
    const lengthHex = clean.slice(64, 128);
    const length = parseInt(lengthHex, 16);
    if (length === 0 || isNaN(length)) return '';
    const dataHex = clean.slice(128, 128 + length * 2);
    let result = '';
    for (let i = 0; i < dataHex.length; i += 2) {
      const code = parseInt(dataHex.slice(i, i + 2), 16);
      if (code > 0) result += String.fromCharCode(code);
    }
    return result.trim();
  } catch {
    return '';
  }
}

function decodeUint256(hex: string): number {
  try {
    if (!hex || hex === '0x') return 0;
    return parseInt(hex, 16) || 0;
  } catch {
    return 0;
  }
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
        id: 1,
      }),
    });
    const result = await response.json();
    return result.result ?? '0x';
  } catch {
    return '0x';
  }
}

// Fetch ERC-20 token metadata from the blockchain
export async function fetchTokenMetadataFromChain(
  contractAddress: string,
  networkId: Exclude<NetworkId, 'solana'>
): Promise<TokenMetadata> {
  const network = NETWORKS[networkId];
  const rpcUrl = network.rpcUrl;

  // Parallel RPC calls for all token fields
  const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
    ethCall(rpcUrl, contractAddress, SEL_NAME),
    ethCall(rpcUrl, contractAddress, SEL_SYMBOL),
    ethCall(rpcUrl, contractAddress, SEL_DECIMALS),
    ethCall(rpcUrl, contractAddress, SEL_TOTAL_SUPPLY),
  ]);

  const name = decodeString(nameHex) || 'Unknown Token';
  const symbol = decodeString(symbolHex) || 'TOKEN';
  const decimals = decodeUint256(decimalsHex) || 18;

  // Parse total supply
  let totalSupply: string | undefined;
  if (supplyHex && supplyHex !== '0x') {
    const raw = BigInt(supplyHex);
    const div = BigInt(10 ** decimals);
    totalSupply = (raw / div).toString();
  }

  if (name === 'Unknown Token' && symbol === 'TOKEN' && decimals === 18) {
    throw new Error(
      `Could not fetch token metadata for ${contractAddress}. ` +
      'Please verify the contract address and network.'
    );
  }

  return {
    name,
    symbol: symbol.toUpperCase(),
    decimals,
    totalSupply,
    contractAddress,
    network: networkId,
    chainId: network.chainId,
    color: '#00D4FF',
    createdAt: new Date().toISOString(),
  };
}

// Check if a Supabase backend has token metadata by contract address
// Returns the Pinata CID if found, null otherwise
export async function lookupTokenInSupabase(
  contractAddress: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<string | null> {
  try {
    const url = `${supabaseUrl}/rest/v1/tokens?contract_address=eq.${contractAddress.toLowerCase()}&select=pinata_cid&limit=1`;
    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) return null;
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0].pinata_cid ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
