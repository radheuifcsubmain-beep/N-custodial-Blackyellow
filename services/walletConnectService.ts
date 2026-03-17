// OnSpace Wallet — WalletConnect URI handler
// Handles WC URI parsing and connection request state management
import AsyncStorage from '@react-native-async-storage/async-storage';

const WC_PENDING_KEY = 'onspace_wc_pending';
const WC_SESSIONS_KEY = 'onspace_wc_sessions_v1';

export interface WCConnectionRequest {
  id: string;
  topic: string;
  dAppName: string;
  dAppUrl: string;
  dAppIcon?: string;
  chainId: number;
  requestedAt: number;
  rawUri: string;
}

export interface WCSession {
  id: string;
  topic: string;
  dAppName: string;
  dAppUrl: string;
  dAppIcon?: string;
  walletAddress: string;
  chainId: number;
  connectedAt: number;
}

// Parse a WalletConnect URI (v1 or v2)
export function parseWCUri(uri: string): Partial<WCConnectionRequest> | null {
  try {
    if (!uri.startsWith('wc:')) return null;

    // WC v2: wc:TOPIC@2?relay-protocol=irn&symKey=...
    // WC v1: wc:TOPIC@1?bridge=...&key=...
    const withoutProtocol = uri.replace('wc:', '');
    const atIdx = withoutProtocol.indexOf('@');
    if (atIdx === -1) return null;

    const topic = withoutProtocol.slice(0, atIdx);
    const rest = withoutProtocol.slice(atIdx + 1);
    const qIdx = rest.indexOf('?');
    const version = qIdx === -1 ? rest : rest.slice(0, qIdx);
    const queryString = qIdx === -1 ? '' : rest.slice(qIdx + 1);

    const params: Record<string, string> = {};
    if (queryString) {
      queryString.split('&').forEach(p => {
        const [k, v] = p.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
      });
    }

    return {
      id: `wc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      topic,
      rawUri: uri,
      requestedAt: Date.now(),
      // These are filled in later when the dApp sends its metadata
      dAppName: params['dappName'] ?? params['label'] ?? 'Unknown DApp',
      dAppUrl: params['dappUrl'] ?? params['url'] ?? '',
      dAppIcon: params['dappIcon'] ?? undefined,
      chainId: params['chainId'] ? parseInt(params['chainId']) : 1,
    };
  } catch {
    return null;
  }
}

// Save a pending connection request
export async function savePendingRequest(req: WCConnectionRequest): Promise<void> {
  await AsyncStorage.setItem(WC_PENDING_KEY, JSON.stringify(req));
}

// Load pending connection request
export async function loadPendingRequest(): Promise<WCConnectionRequest | null> {
  try {
    const raw = await AsyncStorage.getItem(WC_PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Clear pending request
export async function clearPendingRequest(): Promise<void> {
  await AsyncStorage.removeItem(WC_PENDING_KEY);
}

// Load all active sessions
export async function loadSessions(): Promise<WCSession[]> {
  try {
    const raw = await AsyncStorage.getItem(WC_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Approve a connection request — creates a session
export async function approveConnection(
  req: WCConnectionRequest,
  walletAddress: string
): Promise<WCSession> {
  const session: WCSession = {
    id: req.id,
    topic: req.topic,
    dAppName: req.dAppName,
    dAppUrl: req.dAppUrl,
    dAppIcon: req.dAppIcon,
    walletAddress,
    chainId: req.chainId,
    connectedAt: Date.now(),
  };

  const existing = await loadSessions();
  const filtered = existing.filter(s => s.topic !== req.topic);
  await AsyncStorage.setItem(WC_SESSIONS_KEY, JSON.stringify([session, ...filtered]));
  await clearPendingRequest();
  return session;
}

// Reject / disconnect a session
export async function disconnectSession(sessionId: string): Promise<void> {
  const existing = await loadSessions();
  const filtered = existing.filter(s => s.id !== sessionId);
  await AsyncStorage.setItem(WC_SESSIONS_KEY, JSON.stringify(filtered));
}
