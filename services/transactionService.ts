// OnSpace Wallet — Real transaction fetching from testnet/mainnet explorers
import { NETWORKS, NetworkId, EXPLORER_API_KEYS } from '../constants/config';

export interface Transaction {
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
}

// ─── EVM Explorer (Etherscan-compatible) ──────────────────────────────────────

async function fetchEVMTransactions(
  address: string,
  networkId: Exclude<NetworkId, 'solana'>,
  limit = 20
): Promise<Transaction[]> {
  const network = NETWORKS[networkId];
  if (!network.explorerApiUrl) return [];

  const apiKey = networkId === 'ethereum'
    ? EXPLORER_API_KEYS.etherscan
    : networkId === 'bsc'
    ? EXPLORER_API_KEYS.bscscan
    : EXPLORER_API_KEYS.polygonscan;

  const keyParam = apiKey ? `&apikey=${apiKey}` : '';

  try {
    // Fetch normal transactions
    const url = `${network.explorerApiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&offset=${limit}&page=1${keyParam}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!data.result || !Array.isArray(data.result)) return [];

    const txs: Transaction[] = data.result
      .filter((tx: any) => tx.hash && tx.from && tx.to)
      .map((tx: any): Transaction => {
        const valueWei = BigInt(tx.value ?? '0');
        const valueFmt = (Number(valueWei) / 1e18).toFixed(6);
        const isConfirmed = tx.isError === '0' || tx.txreceipt_status === '1';
        const isFailed = tx.isError === '1';

        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: valueFmt,
          symbol: network.symbol,
          timestamp: Number(tx.timeStamp) * 1000,
          status: isFailed ? 'failed' : isConfirmed ? 'confirmed' : 'pending',
          type: tx.from.toLowerCase() === address.toLowerCase() ? 'send' : 'receive',
          network: networkId,
          gasUsed: tx.gasUsed
            ? ((Number(tx.gasUsed) * Number(tx.gasPrice ?? '0')) / 1e18).toFixed(8)
            : undefined,
          blockNumber: tx.blockNumber,
        };
      });

    // Also fetch ERC-20 token transfers
    const tokenUrl = `${network.explorerApiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&offset=${limit}&page=1${keyParam}`;
    const tokenResponse = await fetch(tokenUrl, {
      headers: { Accept: 'application/json' },
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      if (Array.isArray(tokenData.result)) {
        const tokenTxs: Transaction[] = tokenData.result
          .filter((tx: any) => tx.hash && tx.from && tx.to)
          .map((tx: any): Transaction => {
            const decimals = Number(tx.tokenDecimal ?? 18);
            const bigVal = BigInt(tx.value ?? '0');
            const divisor = BigInt(10 ** decimals);
            const whole = bigVal / divisor;
            const rem = bigVal % divisor;
            const fracStr = rem.toString().padStart(decimals, '0').slice(0, 6);
            const valueFmt = `${whole}.${fracStr}`;

            return {
              hash: tx.hash + '_token',
              from: tx.from,
              to: tx.to,
              value: valueFmt,
              symbol: tx.tokenSymbol ?? 'TOKEN',
              timestamp: Number(tx.timeStamp) * 1000,
              status: 'confirmed',
              type: tx.from.toLowerCase() === address.toLowerCase() ? 'send' : 'receive',
              network: networkId,
              tokenName: tx.tokenName,
              tokenSymbol: tx.tokenSymbol,
              isToken: true,
              blockNumber: tx.blockNumber,
            };
          });
        txs.push(...tokenTxs);
      }
    }

    // Sort by timestamp descending
    return txs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  } catch (err) {
    console.log(`[TransactionService] Error fetching ${networkId} txs:`, err);
    return [];
  }
}

// ─── Solana Devnet transactions ───────────────────────────────────────────────

async function fetchSolanaTransactions(
  address: string,
  limit = 20
): Promise<Transaction[]> {
  const network = NETWORKS.solana;

  try {
    // Get recent signatures
    const sigResponse = await fetch(network.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit }],
      }),
    });
    if (!sigResponse.ok) return [];
    const sigData = await sigResponse.json();
    const signatures: any[] = sigData.result ?? [];

    if (signatures.length === 0) return [];

    // Fetch transaction details for first few
    const details = await Promise.allSettled(
      signatures.slice(0, 10).map(async (sig: any) => {
        const txResponse = await fetch(network.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
          }),
        });
        const txData = await txResponse.json();
        return { sig, tx: txData.result };
      })
    );

    const txs: Transaction[] = [];

    for (const result of details) {
      if (result.status !== 'fulfilled' || !result.value.tx) continue;
      const { sig, tx } = result.value;

      // Parse SOL transfer
      const meta = tx.meta;
      const blockTime = tx.blockTime;
      if (!meta || !blockTime) continue;

      const preBalances: number[] = meta.preBalances ?? [];
      const postBalances: number[] = meta.postBalances ?? [];
      const accountKeys: any[] = tx.transaction?.message?.accountKeys ?? [];

      let myIdx = -1;
      for (let i = 0; i < accountKeys.length; i++) {
        const key = typeof accountKeys[i] === 'string'
          ? accountKeys[i]
          : accountKeys[i]?.pubkey ?? '';
        if (key === address) { myIdx = i; break; }
      }

      if (myIdx === -1) continue;

      const pre = preBalances[myIdx] ?? 0;
      const post = postBalances[myIdx] ?? 0;
      const diff = post - pre;
      const valueSol = Math.abs(diff) / 1e9;

      if (valueSol < 0.000001) continue;

      // Determine counterparty
      let counterparty = 'Unknown';
      for (let i = 0; i < accountKeys.length; i++) {
        if (i === myIdx) continue;
        const key = typeof accountKeys[i] === 'string'
          ? accountKeys[i]
          : accountKeys[i]?.pubkey ?? '';
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
    console.log('[TransactionService] Solana error:', err);
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function fetchTransactions(
  address: string,
  networkId: NetworkId,
  limit = 20
): Promise<Transaction[]> {
  if (!address) return [];
  if (networkId === 'solana') {
    return fetchSolanaTransactions(address, limit);
  }
  return fetchEVMTransactions(address, networkId as Exclude<NetworkId, 'solana'>, limit);
}

// Legacy mock fallback (used only if real fetch returns empty)
export function getMockTransactions(
  address: string,
  networkId: NetworkId
): Transaction[] {
  const network = NETWORKS[networkId];
  const now = Date.now();
  return [
    {
      hash: '0x' + address.slice(2, 10) + 'abc123def456',
      from: address,
      to: '0x742d35Cc6634C0532925a3b8D4C9C4f5e2F2B9a1',
      value: '0.05',
      symbol: network.symbol,
      timestamp: now - 3600000,
      status: 'confirmed',
      type: 'send',
      network: networkId,
      gasUsed: '0.000420',
    },
    {
      hash: '0x' + address.slice(2, 10) + 'fed789cba321',
      from: '0x1234567890123456789012345678901234567890',
      to: address,
      value: '0.12',
      symbol: network.symbol,
      timestamp: now - 86400000,
      status: 'confirmed',
      type: 'receive',
      network: networkId,
    },
  ];
}
