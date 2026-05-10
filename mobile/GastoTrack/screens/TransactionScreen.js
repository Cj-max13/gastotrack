import { useState, useCallback } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { getTransactions, updateTransaction } from '../Services/api';
import { useFocusEffect } from '@react-navigation/native';
import { getQueue, getLastSyncTime } from '../Services/OfflineManager';

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
const CATEGORIES = ['food', 'transport', 'entertainment', 'other'];

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [fromCache, setFromCache]       = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync]         = useState(null);

  // Edit modal state
  const [editVisible, setEditVisible]   = useState(false);
  const [editTx, setEditTx]             = useState(null);
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount]     = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState('');

  const load = async () => {
    try {
      const res = await getTransactions();
      setTransactions(res.data);
      setFromCache(!!res.fromCache);
      const queue = await getQueue();
      setPendingCount(queue.length);
      const sync = await getLastSyncTime();
      setLastSync(sync);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  // Group transactions by category, preserving order: food, transport, entertainment, other
  const sections = CATEGORIES
    .map((cat) => ({
      category: cat,
      data: transactions.filter((t) => t.category === cat),
    }))
    .filter((s) => s.data.length > 0);

  // ── Edit helpers ──
  const openEdit = (tx) => {
    setEditTx(tx);
    setEditMerchant(tx.merchant);
    setEditAmount(String(parseFloat(tx.amount)));
    setEditCategory(tx.category);
    setSaveError('');
    setEditVisible(true);
  };

  const closeEdit = () => {
    setEditVisible(false);
    setEditTx(null);
  };

  const handleSave = async () => {
    if (!editMerchant.trim()) { setSaveError('Merchant name is required.'); return; }
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) { setSaveError('Enter a valid amount.'); return; }
    if (!editCategory) { setSaveError('Select a category.'); return; }

    setSaving(true);
    setSaveError('');
    try {
      await updateTransaction(editTx.id, {
        merchant: editMerchant.trim(),
        amount: amt,
        category: editCategory,
      });
      closeEdit();
      setLoading(true);
      load();
    } catch {
      setSaveError('Failed to save. Make sure the server is running.');
    } finally {
      setSaving(false);
    }
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
      <SectionList
        sections={sections}
        keyExtractor={(item, i) => String(item.id || i)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8F135" />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        stickySectionHeadersEnabled={false}
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>No transactions yet.</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { borderLeftColor: CAT_COLORS[section.category] || '#888' }]}>
            <Text style={styles.sectionIcon}>{CAT_ICONS[section.category] || '📦'}</Text>
            <Text style={[styles.sectionTitle, { color: CAT_COLORS[section.category] || '#888' }]}>
              {section.category.charAt(0).toUpperCase() + section.category.slice(1)}
            </Text>
            <Text style={styles.sectionCount}>{section.data.length} item{section.data.length !== 1 ? 's' : ''}</Text>
          </View>
        )}
        renderSectionFooter={() => <View style={{ height: 8 }} />}
        renderItem={({ item, index, section }) => (
          <View style={[
            styles.txItem,
            index === section.data.length - 1 && styles.txItemLast,
          ]}>
            <View style={[styles.txIcon, { backgroundColor: (CAT_COLORS[item.category] || '#888') + '20' }]}>
              <Text style={styles.txIconText}>{CAT_ICONS[item.category] || '📦'}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txMerchant}>{item.merchant}</Text>
              <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
            </View>
            <View style={styles.txRight}>
              <Text style={styles.txAmount}>₱{parseFloat(item.amount).toLocaleString()}</Text>
              {item.offline && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>⏳ pending</Text>
                </View>
              )}
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* ── Edit Modal ── */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Transaction</Text>

            <Text style={styles.fieldLabel}>Merchant</Text>
            <TextInput
              style={styles.input}
              value={editMerchant}
              onChangeText={setEditMerchant}
              placeholder="e.g. Jollibee"
              placeholderTextColor="#5A5A54"
            />

            <Text style={styles.fieldLabel}>Amount (₱)</Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="0.00"
              placeholderTextColor="#5A5A54"
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    editCategory === cat && { backgroundColor: (CAT_COLORS[cat] || '#888') + '30', borderColor: CAT_COLORS[cat] || '#888' },
                  ]}
                  onPress={() => setEditCategory(cat)}
                >
                  <Text style={styles.catChipIcon}>{CAT_ICONS[cat]}</Text>
                  <Text style={[
                    styles.catChipText,
                    editCategory === cat && { color: CAT_COLORS[cat] || '#888' },
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeEdit} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#0F0F0F" />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  centered: { flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 13, fontWeight: '600', color: '#5A5A54', letterSpacing: 1.2, marginBottom: 14, textTransform: 'uppercase' },

  // ── Section headers ──
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#181818', borderRadius: 10, padding: 12,
    marginBottom: 6, borderLeftWidth: 3,
  },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize', flex: 1 },
  sectionCount: { fontSize: 11, color: '#5A5A54' },

  // ── Transaction items ──
  txItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#181818', padding: 14,
    marginBottom: 2, borderWidth: 1, borderColor: '#222',
    borderRadius: 0,
  },
  txItemLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 0,
  },
  txIcon: { width: 42, height: 42, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  txIconText: { fontSize: 20 },
  txInfo: { flex: 1 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#F5F5F0', marginBottom: 3 },
  txDate: { fontSize: 11, color: '#5A5A54' },
  txRight: { alignItems: 'flex-end', gap: 4 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#F5F5F0' },

  editBtn: {
    backgroundColor: '#1E2A0A', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#C8F13540',
  },
  editBtnText: { fontSize: 11, color: '#C8F135', fontWeight: '600' },

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

  // ── Edit Modal ──
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: '#181818', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#333',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#F5F5F0', marginBottom: 20 },

  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#5A5A54', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#222', borderRadius: 12, padding: 14,
    color: '#F5F5F0', fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: '#2A2A2A',
  },

  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#222', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  catChipIcon: { fontSize: 14 },
  catChipText: { fontSize: 12, fontWeight: '600', color: '#9A9A92', textTransform: 'capitalize' },

  saveError: { color: '#FF6B6B', fontSize: 12, marginBottom: 12, textAlign: 'center' },

  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: '#222', borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  cancelBtnText: { color: '#9A9A92', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: '#C8F135', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#0F0F0F', fontWeight: '700', fontSize: 15 },
});
