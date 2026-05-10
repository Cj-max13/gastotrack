/**
 * TransactionScreen.js
 * Full transaction history with filters, search, edit, and delete.
 * Connects to GET /transactions, PUT /transactions/:id, DELETE /transactions/:id
 */
import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { getTransactions, updateTransaction, deleteTransaction } from '../Services/api';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

// All 8 categories from the schema
const CATEGORIES = ['food', 'transport', 'entertainment', 'shopping', 'bills', 'health', 'savings', 'other'];

const CAT_ICONS = {
  food:          '🍔',
  transport:     '🚗',
  entertainment: '🎮',
  shopping:      '🛍️',
  bills:         '📱',
  health:        '💊',
  savings:       '💰',
  other:         '📦',
};

const CAT_COLORS = {
  food:          '#FF6B6B',
  transport:     '#4ECDC4',
  entertainment: '#45B7D1',
  shopping:      '#96CEB4',
  bills:         '#FFEAA7',
  health:        '#DDA0DD',
  savings:       '#C8F135',
  other:         '#888888',
};

const SORT_OPTIONS = [
  { label: 'Newest',  sortBy: 'created_at', sortDir: 'DESC' },
  { label: 'Oldest',  sortBy: 'created_at', sortDir: 'ASC'  },
  { label: 'Highest', sortBy: 'amount',     sortDir: 'DESC' },
  { label: 'Lowest',  sortBy: 'amount',     sortDir: 'ASC'  },
];

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [fromCache, setFromCache]       = useState(false);

  // Filters
  const [search, setSearch]             = useState('');
  const [filterCat, setFilterCat]       = useState('');
  const [sortIdx, setSortIdx]           = useState(0);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);

  // Edit modal
  const [editVisible, setEditVisible]   = useState(false);
  const [editTx, setEditTx]             = useState(null);
  const [editMerchant, setEditMerchant] = useState('');
  const [editAmount, setEditAmount]     = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState('');

  const { alertProps, showAlert } = useCustomAlert();

  const load = async (reset = true) => {
    try {
      const currentPage = reset ? 1 : page;
      const sort = SORT_OPTIONS[sortIdx];
      const res = await getTransactions({
        search:   search || undefined,
        category: filterCat || undefined,
        sortBy:   sort.sortBy,
        sortDir:  sort.sortDir,
        page:     currentPage,
        limit:    20,
      });

      const result = res.data?.data ?? res.data ?? [];
      const totalCount = res.data?.total ?? result.length;
      const totalPages = res.data?.totalPages ?? 1;

      if (reset) {
        setTransactions(result);
        setPage(1);
      } else {
        setTransactions(prev => [...prev, ...result]);
      }

      setTotal(totalCount);
      setHasMore(currentPage < totalPages);
      setFromCache(!!res.fromCache);
    } catch {
      // silent — offline handled by api.js
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(true);
    }, [search, filterCat, sortIdx])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [search, filterCat, sortIdx]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setPage(p => {
      const next = p + 1;
      load(false);
      return next;
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (tx) => {
    setEditTx(tx);
    setEditMerchant(tx.merchant);
    setEditAmount(String(parseFloat(tx.amount)));
    setEditCategory(tx.category);
    setSaveError('');
    setEditVisible(true);
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
      setEditVisible(false);
      setLoading(true);
      load(true);
    } catch {
      setSaveError('Failed to save. Make sure the server is running.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (tx) => {
    showAlert({
      icon: '🗑️',
      title: 'Delete Transaction?',
      message: `Delete ₱${parseFloat(tx.amount).toLocaleString()} at ${tx.merchant}?\n\nThis cannot be undone.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(tx.id);
              setTransactions(prev => prev.filter(t => t.id !== tx.id));
              setTotal(prev => prev - 1);
            } catch {
              showAlert({ icon: '❌', title: 'Error', message: 'Could not delete transaction.' });
            }
          },
        },
      ],
    });
  };

  // ── Render item ───────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const color = CAT_COLORS[item.category] || '#888';
    return (
      <View style={styles.txItem}>
        <View style={[styles.txIcon, { backgroundColor: color + '20' }]}>
          <Text style={styles.txIconText}>{CAT_ICONS[item.category] || '📦'}</Text>
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txMerchant} numberOfLines={1}>{item.merchant}</Text>
          <View style={styles.txMeta}>
            <View style={[styles.txBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.txBadgeText, { color }]}>{item.category}</Text>
            </View>
            <Text style={styles.txDate}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
        <View style={styles.txActions}>
          <Text style={styles.txAmount}>₱{parseFloat(item.amount).toLocaleString()}</Text>
          <View style={styles.txBtns}>
            <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
              <Text style={styles.editBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
              <Text style={styles.deleteBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
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
      <CustomAlert {...alertProps} />

      {/* ── Search bar ── */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search merchant..."
          placeholderTextColor="#5A5A54"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Category filter chips ── */}
      <FlatList
        horizontal
        data={['', ...CATEGORIES]}
        keyExtractor={item => item || 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={{ flexGrow: 0 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterCat === item && styles.filterChipActive,
              item && { borderColor: (CAT_COLORS[item] || '#888') + '60' },
            ]}
            onPress={() => setFilterCat(item)}
          >
            <Text style={styles.filterChipText}>
              {item ? `${CAT_ICONS[item]} ${item}` : 'All'}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Sort options ── */}
      <FlatList
        horizontal
        data={SORT_OPTIONS}
        keyExtractor={item => item.label}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
        style={{ flexGrow: 0 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.sortChip, sortIdx === index && styles.sortChipActive]}
            onPress={() => setSortIdx(index)}
          >
            <Text style={[styles.sortChipText, sortIdx === index && styles.sortChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Offline notice ── */}
      {fromCache && (
        <View style={styles.cacheNotice}>
          <Text style={styles.cacheNoticeText}>📵 Showing cached data</Text>
        </View>
      )}

      {/* ── Transaction list ── */}
      <FlatList
        data={transactions}
        keyExtractor={(item, i) => String(item.id || i)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8F135" />}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <Text style={styles.countLabel}>
            {total} transaction{total !== 1 ? 's' : ''}
            {filterCat ? ` in ${filterCat}` : ''}
            {search ? ` matching "${search}"` : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>
              {search || filterCat ? 'No transactions match your filters.' : 'No transactions yet.\nTap + to add one!'}
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color="#C8F135" style={{ marginVertical: 16 }} /> : null
        }
      />

      {/* ── Edit Modal ── */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Transaction</Text>

            <Text style={styles.fieldLabel}>MERCHANT</Text>
            <TextInput
              style={styles.input}
              value={editMerchant}
              onChangeText={setEditMerchant}
              placeholder="e.g. Jollibee"
              placeholderTextColor="#5A5A54"
            />

            <Text style={styles.fieldLabel}>AMOUNT (₱)</Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="0.00"
              placeholderTextColor="#5A5A54"
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => {
                const color = CAT_COLORS[cat] || '#888';
                const active = editCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catChip,
                      active && { backgroundColor: color + '25', borderColor: color },
                    ]}
                    onPress={() => setEditCategory(cat)}
                  >
                    <Text style={styles.catChipIcon}>{CAT_ICONS[cat]}</Text>
                    <Text style={[styles.catChipText, active && { color }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)} disabled={saving}>
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
  centered:  { flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },

  // ── Search ──
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#181818', borderRadius: 12, margin: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  searchIcon:  { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#F5F5F0' },
  clearSearch: { fontSize: 14, color: '#5A5A54', padding: 4 },

  // ── Filters ──
  filterRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    height: 34,
    backgroundColor: '#181818',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: { backgroundColor: '#C8F13520', borderColor: '#C8F135' },
  filterChipText:   { fontSize: 12, color: '#9A9A92', fontWeight: '500' },

  sortRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    height: 30,
    backgroundColor: '#181818',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortChipActive:    { backgroundColor: '#2A2A2A', borderColor: '#C8F135' },
  sortChipText:      { fontSize: 11, color: '#5A5A54', fontWeight: '500' },
  sortChipTextActive:{ color: '#C8F135' },

  cacheNotice: {
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: '#1A0A00', borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: '#FF6B6B20',
  },
  cacheNoticeText: { fontSize: 11, color: '#FFB347', textAlign: 'center' },

  countLabel: {
    fontSize: 11, color: '#5A5A54', fontWeight: '500',
    marginBottom: 10, letterSpacing: 0.3,
  },

  // ── Transaction item ──
  txItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#181818', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#222',
  },
  txIcon:     { width: 42, height: 42, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  txIconText: { fontSize: 20 },
  txInfo:     { flex: 1, minWidth: 0 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#F5F5F0', marginBottom: 4 },
  txMeta:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  txBadgeText:{ fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  txDate:     { fontSize: 10, color: '#5A5A54' },
  txActions:  { alignItems: 'flex-end', gap: 6 },
  txAmount:   { fontSize: 14, fontWeight: '700', color: '#F5F5F0' },
  txBtns:     { flexDirection: 'row', gap: 6 },
  editBtn: {
    backgroundColor: '#1E2A0A', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#C8F13540',
  },
  editBtnText:  { fontSize: 12 },
  deleteBtn: {
    backgroundColor: '#2A1515', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: '#FF6B6B40',
  },
  deleteBtnText: { fontSize: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyText:  { color: '#5A5A54', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // ── Edit Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: '#181818', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#333',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#F5F5F0', marginBottom: 20 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: '#5A5A54',
    letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#222', borderRadius: 12, padding: 14,
    color: '#F5F5F0', fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#222', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  catChipIcon: { fontSize: 13 },
  catChipText: { fontSize: 11, fontWeight: '600', color: '#9A9A92', textTransform: 'capitalize' },
  saveError:   { color: '#FF6B6B', fontSize: 12, marginBottom: 12, textAlign: 'center' },
  modalActions:{ flexDirection: 'row', gap: 12 },
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
