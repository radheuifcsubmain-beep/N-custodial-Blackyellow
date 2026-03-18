// OnSpace Wallet — Alchemy transaction history service
import { NetworkId } from '../constants/config';

const ALCHEMY_KEY = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? '';

export interface AlchemyTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  symbol: string;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  type: 'send' | 'receive';
  network: NetworkId;
  gasUsed?: string;
  tokenName?: string;
  tokenSymbol?: string;
  isToken?: boolean;
  blockNumber?: string;
  asset?: string;
}

function getAlchemyUrl(networkId: NetworkId, isTestnet: boolean): string {
  if (!ALCHEMY_KEY) {
    // Provide non-Alchemy public RPC as fallback for network-based data; does not support alchemy_getAssetTransfers.
    if (networkId === 'ethereum') {
      return isTestnet ? 'https://rpc.sepolia.org' : 'https://mainnet.infura.io/v3/';
    }
    if (networkId === 'bsc') {
      return isTestnet ? 'https://data-seed-prebsc-1-s1.binance.org:8545' : 'https://bsc-dataseed.binance.org/';
    }
    if (networkId === 'polygon') {
      return isTestnet ? 'https://rpc-amoy.polygon.technology' : 'https://polygon-rpc.com';
    }
    if (networkId === 'solana') {
      return isTestnet ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com';
    }
    return '';
  }
  const k = ALCHEMY_KEY;
  if (networkId === 'ethereum') {
    return isTestnet
      ? `https://eth-sepolia.g.alchemy.com/v2/${k}`
      : `https://eth-mainnet.g.alchemy.com/v2/${k}`;
  }
  if (networkId === 'bsc') {
    return isTestnet
      ? `https://bnb-testnet.g.alchemy.com/v2/${k}`
      : `https://bnb-mainnet.g.alchemy.com/v2/${k}`;
  }
  if (networkId === 'polygon') {
    return isTestnet
      ? `https://polygon-amoy.g.alchemy.com/v2/${k}`
      : `https://polygon-mainnet.g.alchemy.com/v2/${k}`;
  }
  if (networkId === 'solana') {
    return isTestnet
      ? `https://solana-devnet.g.alchemy.com/v2/${k}`
      : `https://solana-mainnet.g.alchemy.com/v2/${k}`;
  }
  return '';
}

async function fetchEVMAlchemyTransactions(
  address: string,
  networkId: Exclude<NetworkId, 'solana'>,
  isTestnet: boolean,
  limit = 25
): Promise<AlchemyTransaction[]> {
  const rpcUrl = getAlchemyUrl(networkId, isTestnet);
  if (!rpcUrl) return [];

  const categoriesByNetwork: Record<string, string[]> = {
    ethereum: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
    polygon: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
    bsc: ['external', 'erc20', 'erc721', 'erc1155'],
  };
  const categories = categoriesByNetwork[networkId] ?? ['external', 'erc20', 'erc721', 'erc1155'];

  let rawTxs: any[] = [];

  try {
    const [outgoing, incoming] = await Promise.allSettled([
      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            fromAddress: address,
            category: categories,
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: `0x${limit.toString(16)}`,
            order: 'desc',
          }],
        }),
      }).then(async (r) => {
        const json = await r.json();
        if (json.error) {
          console.log('[AlchemyService] outgoing error', json.error);
          return { result: { transfers: [] } };
        }
        return json;
      }).catch((err) => {
        console.log('[AlchemyService] outgoing request failed', err);
        return { result: { transfers: [] } };
      }),
      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 2,
          jsonrpc: '2.0',
          method: 'alchemy_getAssetTransfers',
          params: [{
            fromBlock: '0x0',
            toAddress: address,
            category: categories,
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: `0x${limit.toString(16)}`,
            order: 'desc',
          }],
        }),
      }).then(async (r) => {
        const json = await r.json();
        if (json.error) {
          console.log('[AlchemyService] incoming error', json.error);
          return { result: { transfers: [] } };
        }
        return json;
      }).catch((err) => {
        console.log('[AlchemyService] incoming request failed', err);
        return { result: { transfers: [] } };
      }),
    ]);

    if (outgoing.status === 'fulfilled') {
      const transfers = outgoing.value?.result?.transfers ?? [];
      for (const t of transfers) rawTxs.push({ ...t, _dir: 'send' });
    }
    if (incoming.status === 'fulfilled') {
      const transfers = incoming.value?.result?.transfers ?? [];
      for (const t of transfers) rawTxs.push({ ...t, _dir: 'receive' });
    }
  } catch (err) {
    console.log('[AlchemyService] fetchEVMAlchemyTransactions error:', err);
  }

  const seen = new Set<string>();
  const txs: AlchemyTransaction[] = [];

  for (const t of rawTxs) {
    const dedupeKey = `${t.hash}_${t._dir}_${t.from}_${t.to}_${t.asset}_${t.value}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const isToken = t.category === 'erc20' || t.category === 'erc721' || t.category === 'erc1155';
    let value = '0.000000';
    if (isToken && t.rawContract?.value && t.rawContract?.decimal) {
      const raw = BigInt(t.rawContract.value.toString?.() ?? t.rawContract.value);
      const decimals = Number(t.rawContract.decimal);
      if (!Number.isNaN(decimals) && decimals >= 0) {
        const scaled = Number(raw) / 10 ** decimals;
        value = scaled.toFixed(6);
      } else {
        value = String(t.value ?? '0');
      }
    } else if (t.value != null) {
      const rawValue = Number(t.value);
      if (!Number.isNaN(rawValue)) {
        value = rawValue.toFixed(6);
      } else {
        value = String(t.value);
      }
    }

    const blockNum = t.blockNum ? parseInt(t.blockNum, 16).toString() : undefined;
    const timestamp = t.metadata?.blockTimestamp
      ? new Date(t.metadata.blockTimestamp).getTime()
      : Date.now();

    txs.push({
      hash: t.hash ?? '',
      from: t.from ?? '',
      to: t.to ?? '',
      value,
      symbol: t.asset ?? (isToken ? 'TOKEN' : networkId === 'bsc' ? 'BNB' : networkId === 'polygon' ? 'POL' : 'ETH'),
      timestamp,
      status: 'confirmed',
      type: t._dir === 'send' || t._dir === 'receive' ? t._dir : 'receive',
      network: networkId,
      tokenName: isToken ? t.asset : undefined,
      tokenSymbol: isToken ? t.asset : undefined,
      isToken,
      blockNumber: blockNum,
      asset: t.asset,
    });
  }

  return txs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

async function fetchSolanaAlchemyTransactions(
  address: string,
  isTestnet: boolean,
  limit = 25
): Promise<AlchemyTransaction[]> {
  const rpcUrl = getAlchemyUrl('solana', isTestnet);
  if (!rpcUrl) return [];

  try {
    const sigRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit }],
      }),
    });
    const sigData = await sigRes.json();
    const signatures: any[] = sigData.result ?? [];
    if (signatures.length === 0) return [];

    const details = await Promise.allSettled(
      signatures.slice(0, 10).map(async (sig: any) => {
        const txRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
          }),
        });
        const txData = await txRes.json();
        return { sig, tx: txData.result };
      })
    );

    const txs: AlchemyTransaction[] = [];
    for (const result of details) {
      if (result.status !== 'fulfilled' || !result.value.tx) continue;
      const { sig, tx } = result.value;
      const meta = tx.meta;
      const blockTime = tx.blockTime;
      if (!meta || !blockTime) continue;

      const preBalances: number[] = meta.preBalances ?? [];
      const postBalances: number[] = meta.postBalances ?? [];
      const accountKeys: any[] = tx.transaction?.message?.accountKeys ?? [];

      let myIdx = -1;
      for (let i = 0; i < accountKeys.length; i++) {
        const key = typeof accountKeys[i] === 'string' ? accountKeys[i] : accountKeys[i]?.pubkey ?? '';
        if (key === address) { myIdx = i; break; }
      }
      if (myIdx === -1) continue;

      const diff = (postBalances[myIdx] ?? 0) - (preBalances[myIdx] ?? 0);
      const valueSol = Math.abs(diff) / 1e9;
      if (valueSol < 0.000001) continue;

      let counterparty = 'Unknown';
      for (let i = 0; i < accountKeys.length; i++) {
        if (i === myIdx) continue;
        const key = typeof accountKeys[i] === 'string' ? accountKeys[i] : accountKeys[i]?.pubkey ?? '';
        if (key) { counterparty = key; break; }
      }

      txs.push({
        hash: sig.signature,
        from: diff < 0 ? address : counterparty,
        to: diff < 0 ? counterparty : address,
        value: valueSol.toFixed(6),
        symbol: 'SOL',
        timestamp: blockTime * 1000,
        status: meta.err ? 'failed' : 'confirmed',
        type: diff < 0 ? 'send' : 'receive',
        network: 'solana',
      });
    }
    return txs;
  } catch (err) {
    console.log('[AlchemyService] Solana error:', err);
    return [];
  }
}

const BSCSCAN_KEY = process.env.EXPO_PUBLIC_BSCSCAN_API_KEY ?? '';
const ETHERSCAN_KEY = process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY ?? '';
const POLYGONSCAN_KEY = process.env.EXPO_PUBLIC_POLYGONSCAN_API_KEY ?? '';

async function fetchEtherscanTransactions(
  address: string,
  isTestnet: boolean,
  limit = 25
): Promise<AlchemyTransaction[]> {
  const baseUrl = isTestnet
    ? 'https://api-sepolia.etherscan.io/api'
    : 'https://api.etherscan.io/api';
  if (!ETHERSCAN_KEY) {
    console.log('[AlchemyService] Etherscan API key missing; using generic YourApiKeyToken fallback');
  }

  try {
    const params = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: String(limit),
      sort: 'desc',
      apikey: ETHERSCAN_KEY || 'YourApiKeyToken',
    });
    const res = await fetch(`${baseUrl}?${params.toString()}`);
    const data = await res.json();
    if (!data || data.status !== '1' || !Array.isArray(data.result)) return [];
    return data.result.slice(0, limit).map((tx: any) => {
      const value = Number(tx.value || '0') / 1e18;
      const fromLower = String(tx.from || '').toLowerCase();
      const isSend = fromLower === address.toLowerCase();
      return {
        hash: String(tx.hash || ''),
        from: String(tx.from || ''),
        to: String(tx.to || ''),
        value: value.toFixed(6),
        symbol: 'ETH',
        timestamp: Number(tx.timeStamp || 0) * 1000,
        status: tx.txreceipt_status === '1' || tx.isError === '0' ? 'confirmed' : 'failed',
        type: isSend ? 'send' : 'receive',
        network: 'ethereum' as NetworkId,
        blockNumber: String(tx.blockNumber || ''),
        asset: 'ETH',
      };
    });
  } catch (err) {
    console.log('[AlchemyService] Etherscan error:', err);
    return [];
  }
}

async function fetchBscScanTransactions(
  address: string,
  isTestnet: boolean,
  limit = 25
): Promise<AlchemyTransaction[]> {
  if (!BSCSCAN_KEY) return [];
  const baseUrl = isTestnet
    ? 'https://api-testnet.bscscan.com/api'
    : 'https://api.bscscan.com/api';

  try {
    const params = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: String(limit),
      sort: 'desc',
      apikey: BSCSCAN_KEY,
    });
    const res = await fetch(`${baseUrl}?${params.toString()}`);
    const data = await res.json();
    if (!data) return [];
    if (typeof data.message === 'string' && data.message.toLowerCase().includes('deprecated')) {
      console.log('[AlchemyService] BscScan endpoint deprecated; skip fallback.');
      return [];
    }
    if (data.status !== '1' || !Array.isArray(data.result)) return [];

    return data.result.slice(0, limit).map((tx: any) => {
      const value = Number(tx.value || '0') / 1e18;
      const lowercaseAddress = address.toLowerCase();
      const from = String(tx.from || '').toLowerCase();
      const to = String(tx.to || '').toLowerCase();
      const isSend = from === lowercaseAddress;
      return {
        hash: String(tx.hash || ''),
        from: String(tx.from || ''),
        to: String(tx.to || ''),
        value: value.toFixed(6),
        symbol: 'BNB',
        timestamp: Number(tx.timeStamp || 0) * 1000,
        status: tx.isError === '0' ? 'confirmed' : 'failed',
        type: isSend ? 'send' : 'receive',
        network: 'bsc' as NetworkId,
        blockNumber: String(tx.blockNumber || ''),
        asset: 'BNB',
      };
    });
  } catch (err) {
    console.log('[AlchemyService] BscScan error:', err);
    return [];
  }
}

export async function fetchAlchemyTransactions(
  address: string,
  networkId: NetworkId,
  isTestnet: boolean,
  limit = 25
): Promise<AlchemyTransaction[]> {
  if (!address) return [];
  console.log(`[AlchemyService] fetchAlchemyTransactions ${networkId} ${isTestnet ? 'testnet' : 'mainnet'} address=${address}`);

  try {
    if (networkId === 'solana') {
      const solTxs = await fetchSolanaAlchemyTransactions(address, isTestnet, limit);
      console.log(`[AlchemyService] Got ${solTxs.length} Solana txs`);
      return solTxs;
    }

    if (networkId === 'bsc' && !ALCHEMY_KEY) {
      const bscTxs = await fetchBscScanTransactions(address, isTestnet, limit);
      console.log(`[AlchemyService] fallback BscScan ${bscTxs.length} txs for ${address}`);
      return bscTxs;
    }

    if (networkId === 'ethereum' && !ALCHEMY_KEY) {
      const ethTxs = await fetchEtherscanTransactions(address, isTestnet, limit);
      console.log(`[AlchemyService] fallback Etherscan ${ethTxs.length} txs for ${address}`);
      return ethTxs;
    }

    const evmTxs = await fetchEVMAlchemyTransactions(address, networkId as Exclude<NetworkId, 'solana'>, isTestnet, limit);
    console.log(`[AlchemyService] Got ${evmTxs.length} txs from Alchemy for ${address} on ${networkId}`);
    if (evmTxs.length > 0) return evmTxs;

    if (networkId === 'bsc') {
      const bscTxs = await fetchBscScanTransactions(address, isTestnet, limit);
      console.log(`[AlchemyService] Got ${bscTxs.length} txs from BscScan fallback for ${address}`);
      return bscTxs;
    }
    if (networkId === 'ethereum') {
      const ethTxs = await fetchEtherscanTransactions(address, isTestnet, limit);
      console.log(`[AlchemyService] Got ${ethTxs.length} txs from Etherscan fallback for ${address}`);
      return ethTxs;
    }

    return [];
  } catch (err) {
    console.log('[AlchemyService] Error:', err);
    if (networkId === 'bsc') {
      const bscTxs = await fetchBscScanTransactions(address, isTestnet, limit);
      console.log(`[AlchemyService] Got ${bscTxs.length} txs from BscScan after error for ${address}`);
      return bscTxs;
    }
    if (networkId === 'ethereum') {
      const ethTxs = await fetchEtherscanTransactions(address, isTestnet, limit);
      console.log(`[AlchemyService] Got ${ethTxs.length} txs from Etherscan after error for ${address}`);
      return ethTxs;
    }
    return [];
  }
}

export function isAlchemyConfigured(): boolean {
  return !!ALCHEMY_KEY;
}
