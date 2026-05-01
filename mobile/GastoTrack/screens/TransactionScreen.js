import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { getTransactions } from '../Services/api';
import { useFocusEffect } from '@react-navigation/native';
import { getQueue, getLastSyncTime } from '../services/OfflineManager';

const CAT_COLORS = {
  food: '#FF6B6B',
  transport: '#4ECDC4',
  entertainment: '#FFE66D',
  other: '#A8A8A0',
};
const CAT_ICONS = {
  food: '🍔',
  transport: '🚗',
  entertainment: '🎬',
  other: '📦',
};

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);

  const load = async () => {
    try {
      const res = await getTransactions();
      setTransactions(res.data);
      setFromCache(!!res.fromCache);
      const queue = await getQueue();
      setPendingCount(queue.length);
      const sync = await getLastSyncTime();
      setLastSync(sync);
    } catch (e) {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-reload every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#C8F135" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item, i) => String(item.id || i)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8F135" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>No transactions yet.</Text>
          </View>
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.header}>All Transactions ({transactions.length})</Text>
            {fromCache && (
              <View style={styles.cacheNotice}>
                <Text style={styles.cacheNoticeText}>
                  📵 Showing cached data
                  {lastSync ? ` · Last synced ${new Date(lastSync).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Text>
              </View>
            )}
            {pendingCount > 0 && (
              <View style={styles.pendingNotice}>
                <Text style={styles.pendingNoticeText}>
                  ⏳ {pendingCount} transaction{pendingCount > 1 ? 's' : ''} pending sync
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.txItem}>
            <View style={[styles.txIcon, { backgroundColor: (CAT_COLORS[item.category] || '#888') + '20' }]}>
              <Text style={styles.txIconText}>{CAT_ICONS[item.category] || '📦'}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txMerchant}>{item.merchant}</Text>
              <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
            </View>
            <View style={styles.txRight}>
              <Text style={styles.txAmount}>₱{parseFloat(item.amount).toLocaleString()}</Text>
              <View style={[styles.txBadge, { backgroundColor: (CAT_COLORS[item.category] || '#888') + '20' }]}>
                <Text style={[styles.txBadgeText, { color: CAT_COLORS[item.category] || '#888' }]}>
                  {item.category}
                </Text>
              </View>
              {item.offline && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>⏳ pending</Text>
                </View>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  centered: { flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 13, fontWeight: '600', color: '#5A5A54', letterSpacing: 1.2, marginBottom: 14, textTransform: 'uppercase' },

  txItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#181818', borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#222',
  },
  txIcon: { width: 42, height: 42, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  txIconText: { fontSize: 20 },
  txInfo: { flex: 1 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#F5F5F0', marginBottom: 3 },
  txDate: { fontSize: 11, color: '#5A5A54' },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#F5F5F0' },
  txBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  txBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#5A5A54', fontSize: 14 },

  cacheNotice: {
    backgroundColor: '#1A0A00', borderRadius: 10, padding: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#FF6B6B20',
  },
  cacheNoticeText: { fontSize: 12, color: '#FFB347' },

  pendingNotice: {
    backgroundColor: '#0A1A2A', borderRadius: 10, padding: 10,
    marginBottom: 10, borderWidth: 1, borderColor: '#4ECDC420',
  },
  pendingNoticeText: { fontSize: 12, color: '#4ECDC4' },

  pendingBadge: {
    backgroundColor: '#1A0A00', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#FFB34740',
  },
  pendingBadgeText: { fontSize: 9, color: '#FFB347', fontWeight: '600' },
});
