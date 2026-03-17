// Powered by OnSpace.AI
// ERC-20 / BEP-20 token balance fetching via balanceOf() JSON-RPC calls

import { NetworkId } from '../constants/config';

// ─── Token definitions ────────────────────────────────────────────────────────

export interface TokenDef {
  symbol: string;
  name: string;
  decimals: number;
  coinGeckoId: string;
  addresses: Partial<Record<Exclude<NetworkId, 'solana'>, string>>;
  color: string;
}

export const EVM_TOKENS: TokenDef[] = [
  {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    coinGeckoId: 'tether',
    color: '#26A17B',
    addresses: {
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      bsc: '0x55d398326f99059fF775485246999027B3197955',
      polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    coinGeckoId: 'usd-coin',
    color: '#2775CA',
    addresses: {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    },
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    coinGeckoId: 'weth',
    color: '#627EEA',
    addresses: {
      ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      polygon: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    },
  },
  {
    symbol: 'WBNB',
    name: 'Wrapped BNB',
    decimals: 18,
    coinGeckoId: 'wbnb',
    color: '#F3BA2F',
    addresses: {
      bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    },
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    coinGeckoId: 'dai',
    color: '#F5A623',
    addresses: {
      ethereum: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    },
  },
];

// ─── ERC-20 balanceOf via JSON-RPC ────────────────────────────────────────────

// balanceOf(address) selector = 0x70a08231
const BALANCE_OF_SELECTOR = '0x70a08231';

function encodeBalanceOfCall(address: string): string {
  // Pad address to 32 bytes
  const paddedAddr = address.toLowerCase().replace('0x', '').padStart(64, '0');
  return BALANCE_OF_SELECTOR + paddedAddr;
}

async function callContract(
  rpcUrl: string,
  contractAddress: string,
  callData: string
): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_call',
      params: [{ to: contractAddress, data: callData }, 'latest'],
      id: 1,
    }),
  });
  const data = await response.json();
  return data.result || '0x0';
}

function hexToDecimalString(hex: string, decimals: number): string {
  if (!hex || hex === '0x' || hex === '0x0') return '0.000000';
  try {
    const bigVal = BigInt(hex);
    const divisor = BigInt(10 ** decimals);
    const whole = bigVal / divisor;
    const remainder = bigVal % divisor;
    const fracStr = remainder.toString().padStart(decimals, '0').slice(0, 6);
    return `${whole}.${fracStr}`;
  } catch {
    return '0.000000';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface TokenBalance {
  token: TokenDef;
  balance: string;
  usdValue: string;
  networkId: Exclude<NetworkId, 'solana'>;
}

async function fetchTokenPrices(coinIds: string[]): Promise<Record<string, number>> {
  try {
    const ids = [...new Set(coinIds)].join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    const prices: Record<string, number> = {};
    for (const id of coinIds) {
      prices[id] = data[id]?.usd ?? 0;
    }
    return prices;
  } catch {
    // Fallback prices
    return {
      tether: 1,
      'usd-coin': 1,
      weth: 3200,
      wbnb: 580,
      dai: 1,
    };
  }
}

export async function fetchTokenBalances(
  networkId: Exclude<NetworkId, 'solana'>,
  userAddress: string,
  rpcUrl: string
): Promise<TokenBalance[]> {
  const relevantTokens = EVM_TOKENS.filter(t => t.addresses[networkId]);
  if (relevantTokens.length === 0) return [];

  const coinIds = relevantTokens.map(t => t.coinGeckoId);
  const prices = await fetchTokenPrices(coinIds);

  const results = await Promise.allSettled(
    relevantTokens.map(async (token) => {
      const contractAddr = token.addresses[networkId]!;
      const callData = encodeBalanceOfCall(userAddress);
      const rawResult = await callContract(rpcUrl, contractAddr, callData);
      const balance = hexToDecimalString(rawResult, token.decimals);
      const price = prices[token.coinGeckoId] ?? 0;
      const usdValue = (parseFloat(balance) * price).toFixed(2);
      return { token, balance, usdValue, networkId } as TokenBalance;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<TokenBalance> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(tb => parseFloat(tb.balance) > 0 || tb.token.symbol === 'USDT' || tb.token.symbol === 'USDC');
}
