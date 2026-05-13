/**
 * TransactionScreen.js — Redesigned to match the clean light-theme mockup.
 * Groups transactions by date, shows source · category subtitle,
 * colored amounts (red for expenses, green for received).
 * All functionality preserved: search, filter, sort, edit, delete, pagination.
 */
import { useState, useCallback } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native';
import { getTransactions, updateTransaction, deleteTransaction } from '../Services/api';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

const CATEGORIES = ['food', 'transport', 'entertainment', 'shopping', 'bills', 'health', 'savings', 'other'];

// Category display names (title case)
const CAT_LABELS = {
  food:          'Food & Drinks',
  transport:     'Transport',
  entertainment: 'Entertainment',
  shopping:      'Shopping',
  bills:         'Utilities',
  health:        'Health',
  savings:       'Savings',
  other:         'Other',
};

const CAT_ICONS = {
  food:          '🍴',
  transport:     '🚗',
  entertainment: '🎬',
  shopping:      '🛍️',
  bills:         '⚡',
  health:        '💊',
  savings:       '💰',
  other:         '📦',
};

// Soft background colors for the circular icon
const CAT_BG = {
  food:          '#E8F4F8',
  transport:     '#E8F4F8',
  entertainment: '#F0EEF8',
  shopping:      '#EEF8F0',
  bills:         '#FFF8E8',
  health:        '#F8EEF8',
  savings:       '#F0F8E8',
  other:         '#F0F0F0',
};

// Source chip colors
const SOURCE_COLORS = {
  auto:   { bg: '#E8F4FF', text: '#2196F3' },
  manual: { bg: '#F0F0F0', text: '#666666' },
};

// Filter chips — All + categories
const FILTER_CHIPS = [
  { key: '',              label: 'All' },
  { key: 'food',         label: 'Food' },
  { key: 'transport',    label: 'Travel' },
  { key: 'bills',        label: 'Bills' },
  { key: 'shopping',     label: 'Shopping' },
  { key: 'health',       label: 'Health' },
  { key: 'entertainment',label: 'Fun' },
  { key: 'savings',      label: 'Savings' },
  { key: 'other',        label: 'Other' },
];

const SORT_OPTIONS = [
  { label: 'Newest',  sortBy: 'created_at', sortDir: 'DESC' },
  { label: 'Oldest',  sortBy: 'created_at', sortDir: 'ASC'  },
  { label: 'Highest', sortBy: 'amount',     sortDir: 'DESC' },
  { label: 'Lowest',  sortBy: 'amount',     sortDir: 'ASC'  },
];

// ── Date grouping helpers ─────────────────────────────────────────────────────
function getDateLabel(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();

  if (isSameDay(d, now))       return 'TODAY';
  if (isSameDay(d, yesterday)) return 'YESTERDAY';

  return d.toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year:
      d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).toUpperCase();
}

function groupByDate(transactions) {
  const groups = {};
  for (const tx of transactions) {
    const label = getDateLabel(tx.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  }
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [sortIdx, setSortIdx]   = useState(0);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

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
        limit:    30,
      });

      const result     = res.data?.data ?? res.data ?? [];
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
    } catch { /* silent */ }
    finally {
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
    setPage(p => { load(false); return p + 1; });
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
      await updateTransaction(editTx.id, { merchant: editMerchant.trim(), amount: amt, category: editCategory });
      setEditVisible(false);
      setLoading(true);
      load(true);
    } catch {
      setSaveError('Failed to save. Check your connection.');
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
          text: 'Delete', style: 'destructive',
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

  // ── Render transaction row ────────────────────────────────────────────────
  const renderItem = ({ item, index, section }) => {
    const isReceived = item.transaction_type === 'received';
    const amountColor = isReceived ? '#2E7D32' : '#C62828';
    const amountPrefix = isReceived ? '+ ' : '- ';
    const bg = CAT_BG[item.category] || '#F0F0F0';
    const isLast = index === section.data.length - 1;

    return (
      <TouchableOpacity
        style={[styles.txRow, isLast && styles.txRowLast]}
        onLongPress={() => openEdit(item)}
        onPress={() => openEdit(item)}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={[styles.txIconWrap, { backgroundColor: bg }]}>
          <Text style={styles.txIconText}>{CAT_ICONS[item.category] || '📦'}</Text>
        </View>

        {/* Info */}
        <View style={styles.txInfo}>
          <Text style={styles.txMerchant} numberOfLines={1}>{item.merchant}</Text>
          <Text style={styles.txSub}>
            {item.source === 'auto' ? 'GCash' : 'Manual'} · {CAT_LABELS[item.category] || item.category}
          </Text>
        </View>

        {/* Amount + actions */}
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, { color: amountColor }]}>
            {amountPrefix}₱{parseFloat(item.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </Text>
          <View style={styles.txActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
              <Text style={styles.actionBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.deleteActionBtn]} onPress={() => handleDelete(item)}>
              <Text style={styles.actionBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const sections = groupByDate(transactions);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1A73E8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <CustomAlert {...alertProps} />

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor="#AAAAAA"
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
      </View>

      {/* ── Filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTER_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.filterChip, filterCat === chip.key && styles.filterChipActive]}
            onPress={() => setFilterCat(chip.key)}
          >
            <Text style={[styles.filterChipText, filterCat === chip.key && styles.filterChipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Sort row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
        style={styles.sortScroll}
      >
        {SORT_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.label}
            style={[styles.sortChip, sortIdx === i && styles.sortChipActive]}
            onPress={() => setSortIdx(i)}
          >
            <Text style={[styles.sortChipText, sortIdx === i && styles.sortChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Transaction list grouped by date ── */}
      <SectionList
        sections={sections}
        keyExtractor={(item, i) => String(item.id || i)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A73E8" />}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderSectionHeader={({ section }) => (
          <Text style={styles.dateHeader}>{section.title}</Text>
        )}
        ListHeaderComponent={
          total > 0 ? (
            <Text style={styles.countLabel}>
              {total} transaction{total !== 1 ? 's' : ''}
              {filterCat ? ` · ${CAT_LABELS[filterCat] || filterCat}` : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>
              {search || filterCat
                ? 'No transactions match your filters.'
                : 'Tap + to add your first expense!'}
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore
            ? <ActivityIndicator color="#1A73E8" style={{ marginVertical: 16 }} />
            : null
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
              placeholderTextColor="#AAAAAA"
            />

            <Text style={styles.fieldLabel}>AMOUNT (₱)</Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="0.00"
              placeholderTextColor="#AAAAAA"
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => {
                const active = editCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, active && styles.catChipActive]}
                    onPress={() => setEditCategory(cat)}
                  >
                    <Text style={styles.catChipIcon}>{CAT_ICONS[cat]}</Text>
                    <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                      {cat}
                    </Text>
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
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centered:  { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },

  // ── Search ──
  searchWrap: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F0F2F5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchIcon:  { fontSize: 15, color: '#888' },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  clearSearch: { fontSize: 14, color: '#AAAAAA', padding: 2 },

  // ── Filter chips ──
  filterScroll: { backgroundColor: '#FFFFFF', flexGrow: 0 },
  filterRow:    { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: '#1A1A1A', borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  filterChipActive: { backgroundColor: '#1A73E8' },
  filterChipText:   { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
  filterChipTextActive: { color: '#FFFFFF' },

  // ── Sort chips ──
  sortScroll: { backgroundColor: '#FFFFFF', flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sortRow:    { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: '#F0F2F5', borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  sortChipActive:    { backgroundColor: '#E8F0FE' },
  sortChipText:      { fontSize: 12, color: '#666666', fontWeight: '500' },
  sortChipTextActive:{ color: '#1A73E8', fontWeight: '600' },

  // ── List ──
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8 },
  countLabel: {
    fontSize: 12, color: '#888888', fontWeight: '500',
    marginBottom: 8, letterSpacing: 0.2,
  },

  // ── Date section header ──
  dateHeader: {
    fontSize: 11, fontWeight: '700', color: '#888888',
    letterSpacing: 1, marginTop: 16, marginBottom: 8,
  },

  // ── Transaction row ──
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    borderRadius: 0,
  },
  txRowLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 4,
  },
  txIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  txIconText: { fontSize: 20 },
  txInfo:     { flex: 1, minWidth: 0 },
  txMerchant: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 3 },
  txSub:      { fontSize: 12, color: '#888888' },
  txRight:    { alignItems: 'flex-end', gap: 4 },
  txAmount:   { fontSize: 15, fontWeight: '700' },
  txActions:  { flexDirection: 'row', gap: 4 },
  actionBtn: {
    backgroundColor: '#F5F5F5', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  deleteActionBtn: { backgroundColor: '#FFF0F0' },
  actionBtnText: { fontSize: 11 },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  emptyText:  { fontSize: 13, color: '#888888', textAlign: 'center', lineHeight: 20 },

  // ── Edit Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#E0E0E0',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 20 },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: '#888888',
    letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14,
    color: '#1A1A1A', fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F5F5', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  catChipActive:    { backgroundColor: '#E8F0FE', borderColor: '#1A73E8' },
  catChipIcon:      { fontSize: 13 },
  catChipText:      { fontSize: 11, fontWeight: '600', color: '#666666', textTransform: 'capitalize' },
  catChipTextActive:{ color: '#1A73E8' },
  saveError: { color: '#C62828', fontSize: 12, marginBottom: 12, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  cancelBtnText: { color: '#666666', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: '#1A73E8', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
