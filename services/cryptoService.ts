// Powered by OnSpace.AI
// Non-custodial wallet — all keys generated and stored locally, never sent to any server.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import { ethers } from 'ethers';
import * as scureBip39 from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';
import * as nacl from 'tweetnacl';
import bs58 from 'bs58';
import CryptoJS from 'react-native-crypto-js';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';
import { STORAGE_KEYS, NetworkId, DERIVATION_PATHS } from '../constants/config';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface WalletAddresses {
  ethereum: string;
  bsc: string;
  polygon: string;
  solana: string;
}

export interface StoredWallet {
  mnemonic: string;
  addresses: WalletAddresses;
}

export interface SendTxParams {
  mnemonic: string;
  toAddress: string;
  amountEth: string;
  networkId: Exclude<NetworkId, 'solana'>;
  rpcUrl: string;
  chainId: number;
  gasSpeed?: 'low' | 'medium' | 'high';
}

export interface TxResult {
  success: boolean;
  hash?: string;
  error?: string;
}

// ─── Encryption key storage key ───────────────────────────────────────────────

const ENC_KEY_STORAGE = 'nw_wallet_enc_key';

// ─── Secure storage (platform-safe) ──────────────────────────────────────────
// On web, expo-secure-store uses in-memory storage so we fall back to localStorage.
// On iOS/Android, it uses the OS Keychain/Keystore (hardware-backed when available).

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDel(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// ─── Encryption key management ────────────────────────────────────────────────
// A random 256-bit key is generated once and stored alongside the wallet.
// The mnemonic is AES-encrypted with this key before being persisted, so even
// if storage is extracted the mnemonic is not recoverable without the key.

async function getOrCreateEncryptionKey(): Promise<string> {
  let key = await secureGet(ENC_KEY_STORAGE);
  if (!key) {
    const bytes = await ExpoCrypto.getRandomBytesAsync(32);
    key = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    await secureSet(ENC_KEY_STORAGE, key);
  }
  return key;
}

function encryptData(data: string, encKey: string): string {
  return CryptoJS.AES.encrypt(data, encKey).toString();
}

function decryptData(ciphertext: string, encKey: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, encKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// ─── Mnemonic generation (standard BIP39 via @scure/bip39) ───────────────────
// Uses expo-crypto for cryptographically secure entropy, then produces a
// fully BIP39-compliant mnemonic with correct checksum via @scure/bip39.

export async function generateMnemonicAsync(): Promise<string> {
  const entropyBytes = await ExpoCrypto.getRandomBytesAsync(16);
  return scureBip39.entropyToMnemonic(entropyBytes, englishWordlist);
}

// ─── Mnemonic validation (BIP39 checksum-verified) ───────────────────────────

export function validateMnemonic(mnemonic: string): boolean {
  return scureBip39.validateMnemonic(mnemonic.trim().toLowerCase(), englishWordlist);
}

// ─── SLIP-0010 ed25519 HD derivation (for Solana) ────────────────────────────
// Uses @noble/hashes HMAC-SHA512 — works in React Native (no SubtleCrypto needed).

function hmacSha512(key: Uint8Array, data: Uint8Array): Uint8Array {
  return hmac(sha512, key, data);
}

function slip10DeriveEd25519(seed: Uint8Array, path: string): Uint8Array {
  const seedLabel = new TextEncoder().encode('ed25519 seed');

  let h = hmacSha512(seedLabel, seed);
  let keyBytes = h.slice(0, 32);
  let chainCode = h.slice(32);

  const segments = path.replace(/^m\//, '').split('/');
  for (const seg of segments) {
    const index = parseInt(seg.replace("'", ''), 10);
    const hardenedIndex = (index + 0x80000000) >>> 0;

    const data = new Uint8Array(37);
    data[0] = 0x00;
    data.set(keyBytes, 1);
    new DataView(data.buffer).setUint32(33, hardenedIndex, false);

    h = hmacSha512(chainCode, data);
    keyBytes = h.slice(0, 32);
    chainCode = h.slice(32);
  }

  return keyBytes;
}

// ─── Address derivation ───────────────────────────────────────────────────────

function deriveEVMWallet(mnemonic: string): ethers.HDNodeWallet {
  return ethers.HDNodeWallet.fromPhrase(
    mnemonic.trim(),
    undefined,
    DERIVATION_PATHS.ethereum,
  );
}

function deriveSolanaAddress(mnemonic: string): string {
  const seed = scureBip39.mnemonicToSeedSync(mnemonic.trim());
  const privKeyBytes = slip10DeriveEd25519(seed, DERIVATION_PATHS.solana);
  const keyPair = nacl.sign.keyPair.fromSeed(privKeyBytes);
  return bs58.encode(keyPair.publicKey);
}

export async function deriveAddresses(mnemonic: string): Promise<WalletAddresses> {
  const evmWallet = deriveEVMWallet(mnemonic);
  const evmAddress = evmWallet.address;
  const solanaAddress = deriveSolanaAddress(mnemonic);
  return {
    ethereum: evmAddress,
    bsc: evmAddress,
    polygon: evmAddress,
    solana: solanaAddress,
  };
}

export function getEVMPrivateKey(mnemonic: string): string {
  return deriveEVMWallet(mnemonic).privateKey;
}

// ─── Wallet storage ───────────────────────────────────────────────────────────

export async function saveWallet(mnemonic: string, addresses: WalletAddresses): Promise<void> {
  const encKey = await getOrCreateEncryptionKey();
  const encryptedMnemonic = encryptData(mnemonic.trim(), encKey);
  await Promise.all([
    secureSet(STORAGE_KEYS.ENCRYPTED_WALLET, encryptedMnemonic),
    secureSet(STORAGE_KEYS.WALLET_ADDRESS, JSON.stringify(addresses)),
    secureSet(STORAGE_KEYS.HAS_WALLET, 'true'),
  ]);
}

export async function loadWallet(): Promise<StoredWallet | null> {
  const hasWallet = await secureGet(STORAGE_KEYS.HAS_WALLET);
  if (hasWallet !== 'true') return null;

  const [encryptedMnemonic, addressesStr] = await Promise.all([
    secureGet(STORAGE_KEYS.ENCRYPTED_WALLET),
    secureGet(STORAGE_KEYS.WALLET_ADDRESS),
  ]);

  if (!encryptedMnemonic || !addressesStr) return null;

  const encKey = await getOrCreateEncryptionKey();
  const mnemonic = decryptData(encryptedMnemonic, encKey);
  if (!mnemonic) throw new Error('Failed to decrypt wallet — encryption key mismatch');

  const addresses = JSON.parse(addressesStr) as WalletAddresses;
  return { mnemonic, addresses };
}

export async function deleteWallet(): Promise<void> {
  await Promise.all([
    secureDel(STORAGE_KEYS.ENCRYPTED_WALLET),
    secureDel(STORAGE_KEYS.WALLET_ADDRESS),
    secureDel(STORAGE_KEYS.HAS_WALLET),
    secureDel(STORAGE_KEYS.SELECTED_NETWORK),
    secureDel(ENC_KEY_STORAGE),
  ]);
}

// ─── EVM Transaction (ethers JsonRpcProvider + EIP-1559 fee support) ──────────

export async function sendEVMTransaction(params: SendTxParams): Promise<TxResult> {
  const { mnemonic, toAddress, amountEth, rpcUrl, chainId, gasSpeed = 'medium' } = params;

  const amountFloat = parseFloat(amountEth);
  if (isNaN(amountFloat) || amountFloat <= 0) {
    return { success: false, error: 'Invalid amount' };
  }

  try {
    const privateKey = getEVMPrivateKey(mnemonic);
    const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
    const wallet = new ethers.Wallet(privateKey, provider);

    const feeData = await provider.getFeeData();
    const multiplier = gasSpeed === 'high' ? 150n : gasSpeed === 'low' ? 80n : 120n;

    const txRequest: ethers.TransactionRequest = {
      to: toAddress,
      value: ethers.parseEther(amountEth),
      gasLimit: 21000n,
    };

    if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
      txRequest.maxFeePerGas = (feeData.maxFeePerGas * multiplier) / 100n;
      txRequest.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * multiplier) / 100n;
      txRequest.type = 2;
    } else if (feeData.gasPrice != null) {
      txRequest.gasPrice = (feeData.gasPrice * multiplier) / 100n;
      txRequest.type = 0;
    }

    const tx = await wallet.sendTransaction(txRequest);
    return { success: true, hash: tx.hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transaction failed';
    return { success: false, error: message };
  }
}
