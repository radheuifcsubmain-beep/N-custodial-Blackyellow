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
  if (!ALCHEMY_KEY) return '';
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

  const categories = ['external', 'internal', 'erc20'];

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
    }).then(r => r.json()),
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
    }).then(r => r.json()),
  ]);

  const rawTxs: any[] = [];

  if (outgoing.status === 'fulfilled') {
    const transfers = outgoing.value?.result?.transfers ?? [];
    for (const t of transfers) rawTxs.push({ ...t, _dir: 'send' });
  }
  if (incoming.status === 'fulfilled') {
    const transfers = incoming.value?.result?.transfers ?? [];
    for (const t of transfers) rawTxs.push({ ...t, _dir: 'receive' });
  }

  const seen = new Set<string>();
  const txs: AlchemyTransaction[] = [];

  for (const t of rawTxs) {
    const dedupeKey = `${t.hash}_${t._dir}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const isToken = t.category === 'erc20' || t.category === 'erc721' || t.category === 'erc1155';
    const rawValue = t.value ?? 0;
    const value = typeof rawValue === 'number' ? rawValue.toFixed(6) : String(rawValue);
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
      type: t._dir as 'send' | 'receive',
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

export async function fetchAlchemyTransactions(
  address: string,
  networkId: NetworkId,
  isTestnet: boolean,
  limit = 25
): Promise<AlchemyTransaction[]> {
  if (!address || !ALCHEMY_KEY) return [];
  try {
    if (networkId === 'solana') {
      return fetchSolanaAlchemyTransactions(address, isTestnet, limit);
    }
    return fetchEVMAlchemyTransactions(address, networkId as Exclude<NetworkId, 'solana'>, isTestnet, limit);
  } catch (err) {
    console.log('[AlchemyService] Error:', err);
    return [];
  }
}

export function isAlchemyConfigured(): boolean {
  return !!ALCHEMY_KEY;
}
