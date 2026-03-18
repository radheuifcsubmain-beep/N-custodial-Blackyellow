# OnSpace Wallet

## Overview

OnSpace Wallet is a non-custodial multi-chain cryptocurrency wallet built with React Native / Expo. It supports Ethereum, BSC, Polygon, and Solana networks, with PIN authentication, Alchemy-powered transaction history, Pinata IPFS + contract-address token import, dynamic mainnet/testnet toggle, and portfolio showing all 4 chain tokens with IPFS logos.

## Tech Stack

- **Framework**: Expo ~53.0.x with Expo Router ~5.0.x
- **Language**: TypeScript
- **Runtime**: React Native 0.79.x + React 19.0.0
- **Web support**: React Native Web ~0.20.0
- **State**: React Context (WalletContext)
- **Package Manager**: pnpm

## Project Structure

```
app/                  # Expo Router file-based routes
  _layout.tsx         # Root layout with WalletProvider
  index.tsx           # Landing/home screen
  create.tsx          # Create wallet screen (with PIN setup step)
  import.tsx          # Import wallet screen (with PIN setup step)
  (tabs)/             # Tab navigation group
    _layout.tsx       # Tab bar layout (hidden when wallet locked)
    index.tsx         # Portfolio tab (testnet badge, Import quick action)
    history.tsx       # Activity tab (real blockchain txs from explorer APIs)
    receive.tsx       # Receive crypto tab
    send.tsx          # Send crypto tab
    discover.tsx      # Built-in dApp browser
    settings.tsx      # Settings (PIN gate, token import, WalletConnect, testnet)
components/
  feature/
    LockScreen.tsx    # PIN/biometric lock screen (keypad UI)
    TokenList.tsx     # Standard + custom (IPFS) token list
    NetworkSelector.tsx
    BalanceCard.tsx
    AssetRow.tsx
    SeedPhraseGrid.tsx
    PrimaryButton.tsx
  ui/
    GlassCard.tsx
constants/
  config.ts           # USE_TESTNETS flag, MAINNET_NETWORKS, TESTNET_NETWORKS
  theme.ts            # Colors, Spacing, Radii, Typography
contexts/
  WalletContext.tsx   # All wallet state + custom token management
hooks/
  useWallet.ts
services/
  biometricService.ts       # PIN storage + biometric auth
  blockchainService.ts      # Multi-chain balance fetching + gas estimation
  cryptoService.ts          # Mnemonic gen/derive/encrypt/store
  tokenService.ts           # ERC-20 balance + CoinGecko prices
  pinataService.ts          # Pinata IPFS token metadata fetch
  customTokenService.ts     # Custom token storage (AsyncStorage)
  transactionService.ts     # Real blockchain tx fetching (explorer APIs + Solana RPC)
  tokenContractService.ts   # Fetch ERC-20 metadata directly from chain via eth_call
  walletConnectService.ts   # WalletConnect URI parsing + session management
```

## Running the App

```bash
PORT=5000 pnpm expo start --web --port 5000
```

The workflow "Start application" handles this automatically.

## Key Features

### 1. PIN-Protected Wallet Removal
- Settings → "Remove Wallet" requires PIN verification first (PinVerify keypad)
- Only after PIN verified, a second confirmation modal appears
- `removeWallet()` called only after both checks pass

### 2. Testnet / Mainnet Switching
- `constants/config.ts` has `USE_TESTNETS = true` flag
- `TESTNET_NETWORKS`: Sepolia (ETH), BSC Testnet, Polygon Amoy, Solana Devnet
- `MAINNET_NETWORKS`: Ethereum, BSC, Polygon (Infura), Solana mainnet
- To switch to mainnet: set `USE_TESTNETS = false` in `constants/config.ts`
- All public testnet RPCs work without API keys

### 3. Real Blockchain Transactions (Activity Tab)
- `services/transactionService.ts` fetches from Etherscan-compatible explorer APIs
- Supports normal txs + ERC-20 token transfers
- Solana: `getSignaturesForAddress` + `getTransaction` RPC calls
- Falls back to demo/mock data when no transactions found
- Pull-to-refresh, tap-to-view-detail, "View on Explorer" button

### 4. Token Import (2 modes)
- **Contract Address**: Fetches ERC-20 name/symbol/decimals via eth_call from blockchain — `services/tokenContractService.ts`
- **Pinata CID**: Fetches JSON metadata from IPFS gateway — `services/pinataService.ts`
- Network selector for EVM chains when importing by contract
- Custom tokens stored in AsyncStorage via `services/customTokenService.ts`

### 5. WalletConnect Integration
- Settings → "Connect DApp": paste a WC URI (wc:...)
- URI parsed by `services/walletConnectService.ts`
- Approval modal shows dApp name, URL, chain ID, security warning
- Sessions stored in AsyncStorage, can be disconnected
- Simplified WC without full WC SDK (URI parsing + session tracking)

### 6. Footer Hidden When Locked
- `app/(tabs)/_layout.tsx`: `tabBarStyle = { display: 'none' }` when `isLocked` is true
- Footer only shown when `hasWallet && !isLocked`

### 7. Pinata IPFS Config
- Settings → "Pinata IPFS Config": enter API key + secret
- Used for authenticated searches when importing by CID

## Environment Variables

- `EXPO_PUBLIC_INFURA_KEY` — Infura project ID (used in mainnet RPC URLs)
- `EXPO_PUBLIC_ETHERSCAN_API_KEY` — Optional: higher rate limits for Sepolia API
- `EXPO_PUBLIC_BSCSCAN_API_KEY` — Optional: higher rate limits for BSC Testnet API
- `EXPO_PUBLIC_POLYGONSCAN_API_KEY` — Optional: higher rate limits for Polygon Amoy API

## Workflow

- **Start application**: `PORT=5000 pnpm expo start --web --port 5000` (webview, port 5000)

## Crypto Service Architecture

`services/cryptoService.ts` uses browser-safe, production-ready libraries:

| Concern | Library |
|---|---|
| Mnemonic generation | `@scure/bip39` + `expo-crypto` |
| EVM derivation | `ethers` HDNodeWallet |
| EVM transactions | `ethers` JsonRpcProvider |
| Solana HD derivation | SubtleCrypto HMAC-SHA512 (SLIP-0010) |
| Solana keypair | `tweetnacl` ed25519 |
| Mnemonic encryption | `react-native-crypto-js` AES-256 |
| Secure storage | `expo-secure-store` (native) / localStorage (web) |
