/**
 * OfflineManager — handles offline transaction queuing and sync.
 *
 * How it works:
 * - When offline: transactions are saved to AsyncStorage queue
 * - When back online: queued transactions are synced to the backend
 * - Local cache: transactions are always cached so the app works offline
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY     = 'offline_queue';
const CACHE_KEY     = 'cached_transactions';
const LAST_SYNC_KEY = 'last_sync_time';

// ── Network status ────────────────────────────────────────────────────────────
export async function isOnline() {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
}

// ── Offline queue ─────────────────────────────────────────────────────────────
export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addToQueue(text) {
  const queue = await getQueue();
  const item = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    text,
    createdAt: new Date().toISOString(),
  };
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item;
}

export async function removeFromQueue(id) {
  const queue = await getQueue();
  const updated = queue.filter(item => item.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// ── Local transaction cache ───────────────────────────────────────────────────
export async function getCachedTransactions() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function cacheTransactions(transactions) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(transactions));
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export async function addToCache(transaction) {
  const cached = await getCachedTransactions();
  cached.unshift(transaction);
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cached));
}

export async function getLastSyncTime() {
  return await AsyncStorage.getItem(LAST_SYNC_KEY);
}

// ── Sync queued transactions to backend ───────────────────────────────────────
export async function syncQueue(postTransactionFn) {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const result = await postTransactionFn(item.text);
      await removeFromQueue(item.id);
      await addToCache(result.data);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// ── Subscribe to network changes ──────────────────────────────────────────────
export function subscribeToNetwork(onOnline, onOffline) {
  return NetInfo.addEventListener(state => {
    const online = state.isConnected && state.isInternetReachable !== false;
    if (online) {
      onOnline();
    } else {
      onOffline();
    }
  });
}
