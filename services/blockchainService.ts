// Powered by OnSpace.AI
import { NETWORKS, NetworkId } from '../constants/config';

// Note: Use TokenBalance from tokenService.ts for ERC-20 tokens
export interface NativeBalance {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  address?: string;
}

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
}

export interface GasEstimate {
  low: string;
  medium: string;
  high: string;
  unit: string;
}

// ─── Native balance ───────────────────────────────────────────────────────────

async function ethGetBalance(address: string, rpcUrl: string): Promise<string> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
    });
    const data = await response.json();
    if (data.result) {
      const wei = BigInt(data.result);
      const eth = Number(wei) / 1e18;
      return eth.toFixed(6);
    }
    return '0.000000';
  } catch {
    return '0.000000';
  }
}

async function solGetBalance(address: string, rpcUrl: string): Promise<string> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getBalance',
        params: [address],
        id: 1,
      }),
    });
    const data = await response.json();
    if (data.result?.value !== undefined) {
      return (data.result.value / 1e9).toFixed(6);
    }
    return '0.000000';
  } catch {
    return '0.000000';
  }
}

// ─── Prices ───────────────────────────────────────────────────────────────────

async function fetchPrices(coinIds: string[]): Promise<Record<string, number>> {
  try {
    const ids = [...new Set(coinIds)].join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await response.json();
    const prices: Record<string, number> = {};
    for (const id of coinIds) {
      prices[id] = data[id]?.usd || 0;
    }
    return prices;
  } catch {
    return {
      ethereum: 3200,
      binancecoin: 580,
      'matic-network': 0.85,
      solana: 145,
    };
  }
}

// ─── Public balance APIs ──────────────────────────────────────────────────────

export async function fetchNetworkBalance(
  networkId: NetworkId,
  address: string
): Promise<{ balance: string; usdValue: string }> {
  const network = NETWORKS[networkId];
  let balance = '0.000000';

  if (networkId === 'solana') {
    balance = await solGetBalance(address, network.rpcUrl);
  } else {
    balance = await ethGetBalance(address, network.rpcUrl);
  }

  const prices = await fetchPrices([network.coinGeckoId]);
  const price = prices[network.coinGeckoId] || 0;
  const usdValue = (parseFloat(balance) * price).toFixed(2);

  return { balance, usdValue };
}

export async function fetchAllBalances(
  addresses: Record<NetworkId, string>
): Promise<Record<NetworkId, { balance: string; usdValue: string }>> {
  const coinIds = Object.values(NETWORKS).map(n => n.coinGeckoId);
  const prices = await fetchPrices(coinIds);

  const results: Partial<Record<NetworkId, { balance: string; usdValue: string }>> = {};

  await Promise.all(
    (Object.keys(NETWORKS) as NetworkId[]).map(async (networkId) => {
      const network = NETWORKS[networkId];
      const address = addresses[networkId];
      let balance = '0.000000';

      if (networkId === 'solana') {
        balance = await solGetBalance(address, network.rpcUrl);
      } else {
        balance = await ethGetBalance(address, network.rpcUrl);
      }

      const price = prices[network.coinGeckoId] || 0;
      const usdValue = (parseFloat(balance) * price).toFixed(2);
      results[networkId] = { balance, usdValue };
    })
  );

  return results as Record<NetworkId, { balance: string; usdValue: string }>;
}

// ─── Gas estimation ───────────────────────────────────────────────────────────

export async function estimateGas(networkId: NetworkId): Promise<GasEstimate> {
  if (networkId === 'solana') {
    return { low: '0.000005', medium: '0.000005', high: '0.000010', unit: 'SOL' };
  }

  const network = NETWORKS[networkId];
  try {
    const response = await fetch(network.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      }),
    });
    const data = await response.json();
    if (data.result) {
      const gasPriceWei = parseInt(data.result, 16);
      const gasLimit = 21000;
      const low = ((gasPriceWei * gasLimit * 0.8) / 1e18).toFixed(6);
      const medium = ((gasPriceWei * gasLimit * 1.2) / 1e18).toFixed(6);
      const high = ((gasPriceWei * gasLimit * 1.5) / 1e18).toFixed(6);
      return { low, medium, high, unit: network.symbol };
    }
  } catch {
    // fallback
  }
  return { low: '0.000420', medium: '0.000504', high: '0.000630', unit: network.symbol };
}

// ─── Mock transaction history (legacy — use transactionService for real txs) ──

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
