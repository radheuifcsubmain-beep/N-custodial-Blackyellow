// Powered by OnSpace.AI
import React, {
  createContext, useState, useEffect, useRef, useCallback, ReactNode, useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateMnemonicAsync, validateMnemonic, deriveAddresses,
  saveWallet, loadWallet, deleteWallet, sendEVMTransaction,
  TxResult, WalletAddresses,
} from '../services/cryptoService';
import { fetchAllBalancesForNetworks } from '../services/blockchainService';
import { fetchTokenBalances, TokenBalance } from '../services/tokenService';
import {
  isBiometricEnabled, setBiometricEnabled,
  authenticateWithBiometrics, isBiometricAvailable,
  savePIN, verifyPIN, hasPIN,
} from '../services/biometricService';
import {
  loadCustomTokens, addCustomToken, removeCustomToken, CustomToken,
} from '../services/customTokenService';
import { TokenMetadata } from '../services/pinataService';
import { NetworkId, getNetworks, STORAGE_KEYS, DEFAULT_USE_TESTNETS } from '../constants/config';

export interface BalanceInfo {
  balance: string;
  usdValue: string;
}

interface WalletContextType {
  setupPIN: (pin: string) => Promise<void>;
  isLoaded: boolean;
  hasWallet: boolean;
  isLocked: boolean;
  mnemonic: string | null;
  addresses: WalletAddresses | null;
  selectedNetwork: NetworkId;
  balances: Partial<Record<NetworkId, BalanceInfo>>;
  tokenBalances: TokenBalance[];
  customTokens: CustomToken[];
  totalUSD: string;
  isLoadingBalances: boolean;
  isLoadingTokens: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  pinEnabled: boolean;
  isTestnet: boolean;
  toggleNetworkMode: () => Promise<void>;
  createWallet: () => Promise<string>;
  importWallet: (mnemonic: string) => Promise<boolean>;
  confirmWalletCreation: (mnemonic: string) => Promise<void>;
  removeWallet: () => Promise<void>;
  setSelectedNetwork: (network: NetworkId) => void;
  refreshBalances: () => Promise<void>;
  refreshTokenBalances: () => Promise<void>;
  getCurrentAddress: () => string;
  sendTransaction: (toAddress: string, amount: string, gasSpeed?: 'low' | 'medium' | 'high') => Promise<TxResult>;
  unlockWithBiometrics: () => Promise<boolean>;
  unlockWithPIN: (pin: string) => Promise<boolean>;
  lockWallet: () => void;
  enableBiometric: (pin: string) => Promise<void>;
  disableBiometric: () => Promise<void>;
  importCustomToken: (metadata: TokenMetadata) => Promise<CustomToken>;
  deleteCustomToken: (tokenId: string) => Promise<void>;
  refreshCustomTokens: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<WalletAddresses | null>(null);
  const [selectedNetwork, setSelectedNetworkState] = useState<NetworkId>('ethereum');
  const [balances, setBalances] = useState<Partial<Record<NetworkId, BalanceInfo>>>({});
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailableState] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [isTestnet, setIsTestnet] = useState(DEFAULT_USE_TESTNETS);

  const addressesRef = useRef<WalletAddresses | null>(null);
  const selectedNetworkRef = useRef<NetworkId>('ethereum');
  const mnemonicRef = useRef<string | null>(null);
  const isTestnetRef = useRef(DEFAULT_USE_TESTNETS);

  addressesRef.current = addresses;
  selectedNetworkRef.current = selectedNetwork;
  mnemonicRef.current = mnemonic;
  isTestnetRef.current = isTestnet;

  // Active networks based on current isTestnet flag
  const activeNetworks = useMemo(() => getNetworks(isTestnet), [isTestnet]);

  // ─── Network toggle ───────────────────────────────────────────────────────

  const toggleNetworkMode = useCallback(async (): Promise<void> => {
    const next = !isTestnetRef.current;
    setIsTestnet(next);
    isTestnetRef.current = next;
    await AsyncStorage.setItem(STORAGE_KEYS.IS_TESTNET, next ? '1' : '0');
  }, []);

  // ─── Callbacks ───────────────────────────────────────────────────────────

  const refreshBalances = useCallback(async (): Promise<void> => {
    const addr = addressesRef.current;
    if (!addr) return;
    setIsLoadingBalances(true);
    try {
      const networks = getNetworks(isTestnetRef.current);
      const result = await fetchAllBalancesForNetworks(addr as Record<NetworkId, string>, networks);
      setBalances(result);
    } catch (e) {
      console.log('[Wallet] Balance fetch error:', e);
    } finally {
      setIsLoadingBalances(false);
    }
  }, []);

  const refreshTokenBalances = useCallback(async (): Promise<void> => {
    const addr = addressesRef.current;
    const network = selectedNetworkRef.current;
    if (!addr || network === 'solana') {
      setTokenBalances([]);
      return;
    }
    setIsLoadingTokens(true);
    try {
      const networks = getNetworks(isTestnetRef.current);
      const net = (networks as any)[network];
      const tokens = await fetchTokenBalances(
        network as Exclude<NetworkId, 'solana'>,
        addr[network],
        net.rpcUrl
      );
      setTokenBalances(tokens);
    } catch (e) {
      console.log('[Wallet] Token fetch error:', e);
      setTokenBalances([]);
    } finally {
      setIsLoadingTokens(false);
    }
  }, []);

  const refreshCustomTokens = useCallback(async (): Promise<void> => {
    try {
      const tokens = await loadCustomTokens();
      setCustomTokens(tokens);
    } catch {
      setCustomTokens([]);
    }
  }, []);

  const createWallet = useCallback(async (): Promise<string> => {
    return generateMnemonicAsync();
  }, []);

  const confirmWalletCreation = useCallback(async (newMnemonic: string): Promise<void> => {
    const derivedAddresses = await deriveAddresses(newMnemonic);
    await saveWallet(newMnemonic, derivedAddresses);
    addressesRef.current = derivedAddresses;
    mnemonicRef.current = newMnemonic;
    setMnemonic(newMnemonic);
    setAddresses(derivedAddresses);
    setHasWallet(true);
    setIsLocked(false);
  }, []);

  const importWallet = useCallback(async (inputMnemonic: string): Promise<boolean> => {
    const trimmed = inputMnemonic.trim().toLowerCase();
    if (!validateMnemonic(trimmed)) return false;
    const derivedAddresses = await deriveAddresses(trimmed);
    await saveWallet(trimmed, derivedAddresses);
    addressesRef.current = derivedAddresses;
    mnemonicRef.current = trimmed;
    setMnemonic(trimmed);
    setAddresses(derivedAddresses);
    setHasWallet(true);
    setIsLocked(false);
    return true;
  }, []);

  const removeWallet = useCallback(async (): Promise<void> => {
    await deleteWallet();
    addressesRef.current = null;
    mnemonicRef.current = null;
    setMnemonic(null);
    setAddresses(null);
    setHasWallet(false);
    setBalances({});
    setTokenBalances([]);
    setCustomTokens([]);
    setIsLocked(false);
    setBiometricEnabledState(false);
    setPinEnabled(false);
  }, []);

  const setSelectedNetwork = useCallback((network: NetworkId) => {
    selectedNetworkRef.current = network;
    setSelectedNetworkState(network);
  }, []);

  const getCurrentAddress = useCallback((): string => {
    const addr = addressesRef.current;
    const network = selectedNetworkRef.current;
    if (!addr) return '';
    return addr[network] || '';
  }, []);

  const sendTransaction = useCallback(async (
    toAddress: string,
    amountEth: string,
    gasSpeed: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<TxResult> => {
    const m = mnemonicRef.current;
    const network = selectedNetworkRef.current;
    if (!m) return { success: false, error: 'Wallet not loaded' };
    if (network === 'solana') return { success: false, error: 'Solana transactions not yet supported' };
    const networks = getNetworks(isTestnetRef.current);
    const net = (networks as any)[network];
    return sendEVMTransaction({
      mnemonic: m,
      toAddress,
      amountEth,
      networkId: network as Exclude<NetworkId, 'solana'>,
      rpcUrl: net.rpcUrl,
      chainId: net.chainId,
      gasSpeed,
    });
  }, []);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const result = await authenticateWithBiometrics();
      if (result.success) { setIsLocked(false); return true; }
    } catch { /* ignore */ }
    return false;
  }, []);

  const unlockWithPIN = useCallback(async (pin: string): Promise<boolean> => {
    try {
      const valid = await verifyPIN(pin);
      if (valid) { setIsLocked(false); return true; }
    } catch { /* ignore */ }
    return false;
  }, []);

  const lockWallet = useCallback(() => setIsLocked(true), []);

  const setupPIN = useCallback(async (pin: string): Promise<void> => {
    await savePIN(pin);
    setPinEnabled(true);
  }, []);

  const enableBiometric = useCallback(async (pin: string): Promise<void> => {
    await savePIN(pin);
    await setBiometricEnabled(true);
    setBiometricEnabledState(true);
    setPinEnabled(true);
  }, []);

  const disableBiometric = useCallback(async (): Promise<void> => {
    await setBiometricEnabled(false);
    setBiometricEnabledState(false);
  }, []);

  const importCustomToken = useCallback(async (metadata: TokenMetadata): Promise<CustomToken> => {
    const addr = addressesRef.current;
    const walletAddresses: Record<NetworkId, string> = {
      ethereum: addr?.ethereum ?? '',
      bsc: addr?.bsc ?? '',
      polygon: addr?.polygon ?? '',
      solana: addr?.solana ?? '',
    };
    const token = await addCustomToken(metadata, walletAddresses);
    setCustomTokens(prev => {
      const filtered = prev.filter(t => t.id !== token.id);
      return [token, ...filtered];
    });
    return token;
  }, []);

  const deleteCustomToken = useCallback(async (tokenId: string): Promise<void> => {
    await removeCustomToken(tokenId);
    setCustomTokens(prev => prev.filter(t => t.id !== tokenId));
  }, []);

  // ─── Load wallet on mount ─────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [bioAvail, bioEnabled, pinExists, stored, customToks, savedTestnet] = await Promise.all([
          isBiometricAvailable().catch(() => false),
          isBiometricEnabled().catch(() => false),
          hasPIN().catch(() => false),
          loadWallet().catch(() => null),
          loadCustomTokens().catch(() => []),
          AsyncStorage.getItem(STORAGE_KEYS.IS_TESTNET).catch(() => null),
        ]);

        if (!mounted) return;

        if (savedTestnet !== null) {
          const testnetVal = savedTestnet === '1';
          setIsTestnet(testnetVal);
          isTestnetRef.current = testnetVal;
        }

        setBiometricAvailableState(bioAvail);
        setBiometricEnabledState(bioEnabled);
        setPinEnabled(pinExists);
        setCustomTokens(customToks);

        if (stored) {
          addressesRef.current = stored.addresses;
          mnemonicRef.current = stored.mnemonic;
          setHasWallet(true);
          setMnemonic(stored.mnemonic);
          setAddresses(stored.addresses);
          if (pinExists || (bioEnabled && bioAvail)) {
            setIsLocked(true);
          }
        }
      } catch (err) {
        console.log('[Wallet] Mount error:', err);
      } finally {
        if (mounted) setIsLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ─── Auto-refresh balances when wallet is ready/unlocked or network mode changes

  useEffect(() => {
    if (hasWallet && !isLocked && addressesRef.current) {
      refreshBalances();
    }
  }, [hasWallet, isLocked, isTestnet, refreshBalances]);

  // ─── Auto-refresh tokens when network or mode changes ─────────────────────

  useEffect(() => {
    if (hasWallet && !isLocked && addressesRef.current) {
      refreshTokenBalances();
    } else {
      setTokenBalances([]);
    }
  }, [selectedNetwork, hasWallet, isLocked, isTestnet, refreshTokenBalances]);

  const totalUSD = Object.values(balances)
    .reduce((sum, b) => sum + parseFloat(b?.usdValue || '0'), 0)
    .toFixed(2);

  return (
    <WalletContext.Provider value={{
      isLoaded, hasWallet, isLocked, mnemonic, addresses,
      selectedNetwork, balances, tokenBalances, customTokens, totalUSD,
      isLoadingBalances, isLoadingTokens,
      biometricEnabled, biometricAvailable, pinEnabled,
      isTestnet, toggleNetworkMode,
      createWallet, importWallet, confirmWalletCreation, removeWallet, setupPIN,
      setSelectedNetwork, refreshBalances, refreshTokenBalances, refreshCustomTokens,
      getCurrentAddress, sendTransaction,
      unlockWithBiometrics, unlockWithPIN, lockWallet,
      enableBiometric, disableBiometric,
      importCustomToken, deleteCustomToken,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
