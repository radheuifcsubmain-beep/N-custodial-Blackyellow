// OnSpace Wallet — Discover / dApp Browser Launcher
// On web: opens in real Chrome tab (iframe-blocked by most sites + enables wallet extensions)
// On native: opens via WebView with full Chrome UA
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Linking, Platform, Animated, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Radii } from '../../constants/theme';

const HISTORY_STORAGE_KEY = 'onspace_browser_history';
const SEARCH_ENGINE = 'https://www.google.com/search?q=';
const MAX_HISTORY = 50;

const DAPPS = [
  { label: 'Uniswap', url: 'https://app.uniswap.org', icon: '🦄', category: 'DEX' },
  { label: 'Aave', url: 'https://app.aave.com', icon: '👻', category: 'DeFi' },
  { label: 'OpenSea', url: 'https://opensea.io', icon: '🌊', category: 'NFT' },
  { label: 'PancakeSwap', url: 'https://pancakeswap.finance', icon: '🥞', category: 'DEX' },
  { label: 'CoinGecko', url: 'https://www.coingecko.com', icon: '🦎', category: 'Data' },
  { label: 'Etherscan', url: 'https://etherscan.io', icon: '🔍', category: 'Explorer' },
  { label: 'BscScan', url: 'https://bscscan.com', icon: '🔗', category: 'Explorer' },
  { label: 'DeFiLlama', url: 'https://defillama.com', icon: '📊', category: 'Data' },
  { label: 'Blur', url: 'https://blur.io', icon: '💨', category: 'NFT' },
  { label: '1inch', url: 'https://app.1inch.io', icon: '⚡', category: 'DEX' },
  { label: 'Compound', url: 'https://app.compound.finance', icon: '🏦', category: 'DeFi' },
  { label: 'Curve', url: 'https://curve.fi', icon: '〰️', category: 'DEX' },
];

const CATEGORIES = ['All', 'DEX', 'DeFi', 'NFT', 'Explorer', 'Data'];

interface HistoryEntry {
  url: string;
  title: string;
  favicon: string;
  visitedAt: number;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed) && !trimmed.includes(' ')) {
    return `https://${trimmed}`;
  }
  return `${SEARCH_ENGINE}${encodeURIComponent(trimmed)}`;
}

function getDisplayTitle(url: string): string {
  try {
    const u = new URL(url);
    const dapp = DAPPS.find(d => d.url.includes(u.hostname) || u.hostname.includes(d.label.toLowerCase()));
    if (dapp) return dapp.label;
    return u.hostname.replace('www.', '');
  } catch {
    if (url.includes('google.com/search')) {
      const q = url.split('q=')[1];
      return q ? decodeURIComponent(q.split('&')[0]) : 'Google Search';
    }
    return url;
  }
}

function getDisplayHost(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getFavicon(url: string): string {
  const dapp = DAPPS.find(d => url.includes(d.url) || d.url.includes(getDisplayHost(url)));
  if (dapp) return dapp.icon;
  return '🌐';
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ms).toLocaleDateString();
}

async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveToHistory(url: string): Promise<HistoryEntry[]> {
  const existing = await loadHistory();
  const title = getDisplayTitle(url);
  const favicon = getFavicon(url);
  // Remove duplicate
  const filtered = existing.filter(h => h.url !== url);
  const updated = [{ url, title, favicon, visitedAt: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

// ── Toast notification component ─────────────────────────────────────────────
function Toast({ message, icon }: { message: string; icon: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[toastStyles.container, { opacity }]}>
      <Text style={toastStyles.icon}>{icon}</Text>
      <Text style={toastStyles.message}>{message}</Text>
    </Animated.View>
  );
}
const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    backgroundColor: '#1a1a2e', borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.primary + '55',
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
    zIndex: 999,
  },
  icon: { fontSize: 20 },
  message: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
});

// ── Native WebView browser ────────────────────────────────────────────────────
function NativeBrowser({ url, onClose }: { url: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const WebView = require('react-native-webview').WebView;
  return (
    <View style={{ flex: 1 }}>
      <View style={nativeStyles.bar}>
        <Pressable onPress={onClose} style={nativeStyles.btn}>
          <MaterialIcons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={nativeStyles.url} numberOfLines={1}>{getDisplayHost(url)}</Text>
        <Pressable onPress={() => Linking.openURL(url)} style={nativeStyles.btn}>
          <MaterialIcons name="open-in-browser" size={20} color={Colors.primary} />
        </Pressable>
      </View>
      {loading && (
        <View style={nativeStyles.loadingBar}>
          <View style={nativeStyles.loadingFill} />
        </View>
      )}
      <WebView
        source={{ uri: url }}
        style={{ flex: 1 }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36"
      />
    </View>
  );
}
const nativeStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radii.full, backgroundColor: Colors.surfaceElevated },
  url: { flex: 1, fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  loadingBar: { height: 2, backgroundColor: Colors.surfaceBorder },
  loadingFill: { height: '100%', width: '60%', backgroundColor: Colors.primary },
});

// ── Main Discover Screen ──────────────────────────────────────────────────────
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [toast, setToast] = useState<{ message: string; icon: string } | null>(null);
  const [nativeUrl, setNativeUrl] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  const showToast = useCallback((message: string, icon: string) => {
    setToast({ message, icon });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const openUrl = useCallback(async (rawUrl: string) => {
    const url = normalizeUrl(rawUrl);
    if (!url) return;

    const updated = await saveToHistory(url);
    setHistory(updated);

    if (Platform.OS === 'web') {
      // Open in real Chrome tab — necessary because:
      // 1. Sites block iframes via X-Frame-Options
      // 2. DApp wallet connections require real browser context
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      const title = getDisplayTitle(url);
      showToast(`Opening ${title} in Chrome...`, '🌐');
    } else {
      // On native, use embedded WebView
      setNativeUrl(url);
    }
    setSearchText('');
  }, [showToast]);

  const handleSearch = useCallback(() => {
    if (!searchText.trim()) return;
    openUrl(searchText.trim());
  }, [searchText, openUrl]);

  const filteredDapps = activeCategory === 'All'
    ? DAPPS
    : DAPPS.filter(d => d.category === activeCategory);

  const displayedHistory = showAllHistory ? history : history.slice(0, 6);

  // ── Native WebView mode ────────────────────────────────────────────────────
  if (Platform.OS !== 'web' && nativeUrl) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <NativeBrowser url={nativeUrl} onClose={() => setNativeUrl(null)} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Google-style header ─────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.googleWordmark}>
            {[
              { char: 'G', color: '#4285F4' }, { char: 'o', color: '#EA4335' },
              { char: 'o', color: '#FBBC05' }, { char: 'g', color: '#34A853' },
              { char: 'l', color: '#EA4335' }, { char: 'e', color: '#4285F4' },
            ].map((item, i) => (
              <Text key={i} style={[styles.googleChar, { color: item.color }]}>{item.char}</Text>
            ))}
          </View>
          <Text style={styles.heroSubtitle}>dApp Browser · Powered by Chrome</Text>

          {/* Search bar */}
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={Colors.textMuted} />
            <TextInput
              ref={searchRef}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              placeholder="Search Google or enter a URL"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              keyboardType="url"
            />
            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText('')} hitSlop={8}>
                <MaterialIcons name="close" size={18} color={Colors.textMuted} />
              </Pressable>
            )}
            <View style={styles.searchDivider} />
            <Pressable onPress={handleSearch} hitSlop={8} style={styles.searchGoBtn}>
              <MaterialIcons name="arrow-forward" size={20} color={Colors.primary} />
            </Pressable>
          </View>

          {Platform.OS === 'web' && (
            <View style={styles.chromeNote}>
              <MaterialIcons name="open-in-new" size={13} color={Colors.accent} />
              <Text style={styles.chromeNoteText}>
                Sites open in Chrome — enables full DApp wallet connections
              </Text>
            </View>
          )}
        </View>

        {/* ── Category filter ─────────────────────────────────────────────── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Recognized DApps</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
          >
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
              >
                <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* DApp grid */}
          <View style={styles.dappGrid}>
            {filteredDapps.map(dapp => (
              <Pressable
                key={dapp.url}
                onPress={() => openUrl(dapp.url)}
                style={({ pressed }) => [styles.dappCard, pressed && styles.dappCardPressed]}
              >
                <View style={styles.dappIconBg}>
                  <Text style={styles.dappEmoji}>{dapp.icon}</Text>
                </View>
                <Text style={styles.dappLabel}>{dapp.label}</Text>
                <View style={styles.dappCatBadge}>
                  <Text style={styles.dappCatText}>{dapp.category}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── URL History ────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <MaterialIcons name="history" size={16} color={Colors.textMuted} />
                <Text style={styles.sectionLabel}>Recent History</Text>
              </View>
              <Pressable
                onPress={async () => {
                  await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
                  setHistory([]);
                }}
                hitSlop={8}
              >
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>

            <View style={styles.historyList}>
              {displayedHistory.map((entry, idx) => (
                <Pressable
                  key={entry.url + entry.visitedAt}
                  onPress={() => openUrl(entry.url)}
                  style={({ pressed }) => [styles.historyItem, pressed && styles.historyItemPressed]}
                >
                  <View style={styles.historyIconBg}>
                    <Text style={styles.historyFavicon}>{entry.favicon}</Text>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle} numberOfLines={1}>{entry.title}</Text>
                    <Text style={styles.historyUrl} numberOfLines={1}>{getDisplayHost(entry.url)}</Text>
                  </View>
                  <Text style={styles.historyTime}>{timeAgo(entry.visitedAt)}</Text>
                  <Pressable
                    onPress={async (e) => {
                      e.stopPropagation?.();
                      const fresh = history.filter((_, i) => i !== idx);
                      setHistory(fresh);
                      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(fresh));
                    }}
                    hitSlop={8}
                    style={styles.historyDelete}
                  >
                    <MaterialIcons name="close" size={14} color={Colors.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </View>

            {history.length > 6 && (
              <Pressable
                onPress={() => setShowAllHistory(!showAllHistory)}
                style={styles.showMoreBtn}
              >
                <MaterialIcons
                  name={showAllHistory ? 'expand-less' : 'expand-more'}
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.showMoreText}>
                  {showAllHistory ? 'Show less' : `Show ${history.length - 6} more`}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Footer info ────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <MaterialIcons name="security" size={13} color={Colors.textMuted} />
          <Text style={styles.footerText}>
            Non-custodial · Your keys stay on this device · Chrome-powered browsing
          </Text>
        </View>
      </ScrollView>

      {/* Toast */}
      {toast && <Toast message={toast.message} icon={toast.icon} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { gap: Spacing.lg, paddingBottom: 20 },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  googleWordmark: { flexDirection: 'row' },
  googleChar: { fontSize: 48, fontWeight: '700' },
  heroSubtitle: { fontSize: 12, color: Colors.textMuted, letterSpacing: 0.5 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.xl,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md, height: 52, width: '100%',
    gap: 8, marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 4,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  searchDivider: { width: 1, height: 24, backgroundColor: Colors.surfaceBorder },
  searchGoBtn: { padding: 4 },
  chromeNote: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.sm, marginTop: 4,
  },
  chromeNoteText: { fontSize: 11, color: Colors.accent, flex: 1 },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  clearText: { fontSize: 12, color: Colors.error, fontWeight: '500' },

  // Category chips
  catScroll: { paddingHorizontal: Spacing.md, gap: 8, paddingBottom: 12 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  catChipActive: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  catChipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  catChipTextActive: { color: Colors.primary, fontWeight: '600' },

  // DApp grid
  dappGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  dappCard: {
    width: '30%', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingVertical: 14, paddingHorizontal: 8,
  },
  dappCardPressed: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary + '55', transform: [{ scale: 0.96 }] },
  dappIconBg: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  dappEmoji: { fontSize: 22 },
  dappLabel: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  dappCatBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.full,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  dappCatText: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },

  // History
  historySection: { gap: 0 },
  historyList: { paddingHorizontal: Spacing.md, gap: 2 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: Radii.md,
  },
  historyItemPressed: { backgroundColor: Colors.surfaceElevated },
  historyIconBg: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  historyFavicon: { fontSize: 18 },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  historyUrl: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  historyTime: { fontSize: 11, color: Colors.textMuted, minWidth: 50, textAlign: 'right' },
  historyDelete: { padding: 4 },
  showMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, marginHorizontal: Spacing.md,
    borderRadius: Radii.md, backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.surfaceBorder, marginTop: 4,
  },
  showMoreText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingHorizontal: Spacing.xl,
  },
  footerText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', flex: 1 },
});
