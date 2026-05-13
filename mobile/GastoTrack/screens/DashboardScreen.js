/**
 * DashboardScreen.js — Redesigned to match the clean light-theme mockup.
 * Sections:
 * 1. Total Spend card with bar chart + active budget
 * 2. Quick Manual Entry card
 * 3. AI Assistant insight strip
 * 4. Recent Activity list
 */
import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, ActivityIndicator, StatusBar,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import {
  getTransactions, getInsights, getBudget,
  postManualTransaction, getCategoryOffsets,
} from '../Services/api';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

const { width } = Dimensions.get('window');
const CHART_W = width - 48;

// ── Category config ───────────────────────────────────────────────────────────
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
const CAT_COLORS = {
  food:          '#00897B',
  transport:     '#1E88E5',
  entertainment: '#8E24AA',
  shopping:      '#43A047',
  bills:         '#00ACC1',
  health:        '#E91E63',
  savings:       '#7CB342',
  other:         '#757575',
};
const SOURCE_LABEL = { auto: 'GCash', manual: 'Manual' };

// ── Build last-7-days bar chart ───────────────────────────────────────────────
function buildWeeklyBars(txList) {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const data   = Array(7).fill(0);
  const now    = new Date();

  txList.forEach(t => {
    const d    = new Date(t.created_at);
    const diff = Math.floor((now - d) / 86400000);
    if (diff >= 0 && diff < 7) {
      const idx = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
      data[idx] += parseFloat(t.amount || 0);
    }
  });

  return { labels, datasets: [{ data: data.map(v => Math.max(1, Math.round(v))) }] };
}

// ── Format relative time ──────────────────────────────────────────────────────
function formatRelativeTime(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  const diffMs   = now - d;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return 'Today, ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (diffDays === 1) {
    return 'Yesterday, ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [insights, setInsights]         = useState(null);
  const [budgetData, setBudgetData]     = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // Quick entry modal
  const [entryVisible, setEntryVisible] = useState(false);
  const [entryText, setEntryText]       = useState('');
  const [entrySaving, setEntrySaving]   = useState(false);
  const [entryError, setEntryError]     = useState('');

  const { alertProps, showAlert } = useCustomAlert();

  const load = async () => {
    try {
      const [txRes, budgetRes] = await Promise.all([
        getTransactions({ limit: 200 }),
        getBudget().catch(() => null),
      ]);

      const txList = Array.isArray(txRes.data) ? txRes.data : (txRes.data?.data ?? []);
      setTransactions(txList);
      if (budgetRes) setBudgetData(budgetRes.data);

      if (txList.length > 0) {
        try {
          const offsetRes = await getCategoryOffsets().catch(() => null);
          const aiRes = await getInsights(txList, null, offsetRes?.data || null);
          setInsights(aiRes.data);
        } catch { setInsights(null); }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const now = new Date();
  const monthTx = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }),
    [transactions]
  );

  const totalSpent = useMemo(
    () => monthTx.reduce((s, t) => s + parseFloat(t.amount || 0), 0),
    [monthTx]
  );

  const monthName = now.toLocaleString('en-PH', { month: 'long' }).toUpperCase();
  const chartData = useMemo(() => buildWeeklyBars(transactions), [transactions]);

  // AI insight message
  const insightMsg = useMemo(() => {
    if (!insights) return null;
    const alerts = insights.overspending_alerts || [];
    const suggestions = insights.suggestions || [];
    if (alerts.length > 0) return `"${alerts[0].message}"`;
    if (suggestions.length > 0) return `"${suggestions[0]}"`;
    return null;
  }, [insights]);

  // Quick entry submit
  const handleQuickEntry = async () => {
    if (!entryText.trim()) { setEntryError('Please describe your expense.'); return; }
    if (!/₱\s?\d+/i.test(entryText) && !/\d+/.test(entryText)) {
      setEntryError('Include an amount, e.g. "Spent ₱150 at Jollibee"');
      return;
    }
    setEntrySaving(true);
    setEntryError('');
    try {
      await postManualTransaction(entryText.trim());
      setEntryVisible(false);
      setEntryText('');
      setLoading(true);
      load();
      showAlert({ icon: '✅', title: 'Saved!', message: 'Transaction recorded.' });
    } catch {
      setEntryError('Could not save. Check your connection.');
    } finally {
      setEntrySaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00897B" />
      </View>
    );
  }

  const recentTx = transactions.slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00897B" />}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <CustomAlert {...alertProps} />

      {/* ── Total Spend Card ── */}
      <View style={styles.spendCard}>
        <Text style={styles.spendLabel}>TOTAL SPEND ({monthName})</Text>
        <Text style={styles.spendAmount}>
          ₱{totalSpent.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </Text>

        {/* Trend line */}
        <View style={styles.trendRow}>
          <Text style={styles.trendIcon}>↘</Text>
          <Text style={styles.trendText}>12% less than last month</Text>
        </View>

        {/* Bar chart + active budget */}
        <View style={styles.chartWrap}>
          <BarChart
            data={chartData}
            width={CHART_W + 32}
            height={110}
            fromZero
            withInnerLines={false}
            withOuterLines={false}
            showValuesOnTopOfBars={false}
            chartConfig={{
              backgroundColor:        'transparent',
              backgroundGradientFrom: 'transparent',
              backgroundGradientTo:   'transparent',
              decimalPlaces: 0,
              color: (opacity, index) => {
                const todayIdx = (new Date().getDay() + 6) % 7;
                return index === todayIdx
                  ? `rgba(0,77,64,${opacity})`
                  : `rgba(176,220,215,${opacity})`;
              },
              labelColor: () => '#BDBDBD',
              barPercentage: 0.5,
              propsForLabels: { fontSize: 10 },
            }}
            style={{ marginLeft: -32, borderRadius: 0 }}
          />

          {/* Active budget — bottom right */}
          {budgetData && (
            <View style={styles.activeBudgetWrap}>
              <Text style={styles.activeBudgetLabel}>ACTIVE BUDGET</Text>
              <Text style={styles.activeBudgetValue}>
                ₱{parseFloat(budgetData.monthly_budget || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </View>

        {/* Budget progress bar — flush at bottom of card */}
        {budgetData && budgetData.monthly_budget > 0 && (
          <View style={styles.budgetBarBg}>
            <View style={[
              styles.budgetBarFill,
              {
                width: `${Math.min((totalSpent / budgetData.monthly_budget) * 100, 100)}%`,
                backgroundColor: totalSpent > budgetData.monthly_budget ? '#E53935' : '#00897B',
              }
            ]} />
          </View>
        )}
      </View>

      {/* ── Quick Manual Entry Card ── */}
      <View style={styles.quickCard}>
        <View style={styles.quickHeader}>
          <View style={styles.quickIconWrap}>
            <Text style={styles.quickIcon}>⊕</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickTitle}>Quick Manual Entry</Text>
            <Text style={styles.quickSub}>Log cash expenses instantly to keep your balance precise.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newTxBtn}
          onPress={() => { setEntryText(''); setEntryError(''); setEntryVisible(true); }}
          activeOpacity={0.85}
        >
          <Text style={styles.newTxBtnText}>New Transaction →</Text>
        </TouchableOpacity>
      </View>

      {/* ── AI Assistant strip ── */}
      {insightMsg && (
        <TouchableOpacity
          style={styles.aiStrip}
          onPress={() => navigation.navigate('Chat')}
          activeOpacity={0.8}
        >
          <View style={styles.aiIconWrap}>
            <Text style={styles.aiIcon}>🤖</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.aiTitle}>AI Assistant</Text>
            <Text style={styles.aiMsg} numberOfLines={2}>{insightMsg}</Text>
          </View>
          <Text style={styles.aiArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* ── Recent Activity ── */}
      <View style={styles.recentHeader}>
        <Text style={styles.recentTitle}>Recent Activity</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
          <Text style={styles.viewAll}>View All ›</Text>
        </TouchableOpacity>
      </View>

      {recentTx.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyText}>No transactions yet.{'\n'}Tap New Transaction to add one!</Text>
        </View>
      ) : (
        recentTx.map((tx, i) => {
          const color = CAT_COLORS[tx.category] || '#757575';
          return (
            <View key={tx.id || i} style={[styles.txRow, i === recentTx.length - 1 && { borderBottomWidth: 0 }]}>
              {/* Icon */}
              <View style={[styles.txIconWrap, { backgroundColor: color + '18' }]}>
                <Text style={styles.txIconText}>{CAT_ICONS[tx.category] || '📦'}</Text>
              </View>

              {/* Info */}
              <View style={styles.txInfo}>
                <Text style={styles.txMerchant} numberOfLines={1}>{tx.merchant}</Text>
                <View style={styles.txSubRow}>
                  <View style={styles.txSourceBadge}>
                    <Text style={styles.txSourceIcon}>▣</Text>
                    <Text style={styles.txSourceText}>{SOURCE_LABEL[tx.source] || 'Manual'}</Text>
                  </View>
                  <Text style={styles.txDot}>·</Text>
                  <Text style={styles.txCat}>
                    {tx.category.charAt(0).toUpperCase() + tx.category.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Amount + time */}
              <View style={styles.txRight}>
                <Text style={styles.txAmount}>
                  -{'\u20B1'}{parseFloat(tx.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </Text>
                <Text style={styles.txTime}>{formatRelativeTime(tx.created_at)}</Text>
              </View>
            </View>
          );
        })
      )}

      <View style={{ height: 100 }} />

      {/* ── Quick Entry Modal ── */}
      <Modal visible={entryVisible} transparent animationType="slide" onRequestClose={() => setEntryVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Quick Entry</Text>
            <Text style={styles.modalSub}>Describe your expense in plain language</Text>

            <TextInput
              style={styles.modalInput}
              placeholder='e.g. "Spent ₱150 at Jollibee"'
              placeholderTextColor="#AAAAAA"
              value={entryText}
              onChangeText={setEntryText}
              multiline
              autoFocus
            />

            {/* Examples */}
            {['Spent ₱150 at Jollibee', 'Grab ride ₱85', 'Paid ₱500 at Netflix'].map((ex, i) => (
              <TouchableOpacity key={i} style={styles.exampleChip} onPress={() => setEntryText(ex)}>
                <Text style={styles.exampleChipText}>{ex}</Text>
              </TouchableOpacity>
            ))}

            {entryError ? <Text style={styles.entryError}>{entryError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEntryVisible(false)} disabled={entrySaving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleQuickEntry} disabled={entrySaving}>
                {entrySaving
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  inner:     { padding: 16, paddingTop: 8 },
  centered:  { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },

  // ── Total Spend Card ──
  spendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 0,          // progress bar sits flush at bottom
    marginBottom: 14,
    overflow: 'hidden',        // clips the progress bar to rounded corners
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  spendLabel:  { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 0.8, marginBottom: 6 },
  spendAmount: { fontSize: 34, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1, marginBottom: 6 },
  trendRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  trendIcon:   { fontSize: 13, color: '#00897B' },
  trendText:   { fontSize: 12, color: '#00897B', fontWeight: '500' },
  chartWrap:   { position: 'relative', marginHorizontal: -20 },
  activeBudgetWrap: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    alignItems: 'flex-end',
  },
  activeBudgetLabel: { fontSize: 9, fontWeight: '700', color: '#9E9E9E', letterSpacing: 0.8 },
  activeBudgetValue: { fontSize: 15, fontWeight: '800', color: '#00897B' },
  budgetBarBg:   { height: 4, backgroundColor: '#E0F2F1', marginTop: 0 },
  budgetBarFill: { height: 4 },

  // ── Quick Entry Card ──
  quickCard: {
    backgroundColor: '#004D40', borderRadius: 16, padding: 20,
    marginBottom: 14,
  },
  quickHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 60 },
  quickIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  quickIcon:  { fontSize: 20, color: '#FFFFFF' },
  quickTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  quickSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 17 },
  newTxBtn: {
    backgroundColor: '#B2EBF2', borderRadius: 30,
    paddingVertical: 14, alignItems: 'center',
  },
  newTxBtnText: { fontSize: 15, fontWeight: '700', color: '#004D40' },

  // ── AI Strip ──
  aiStrip: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#EEEEEE',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  aiIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E0F2F1',
    justifyContent: 'center', alignItems: 'center',
  },
  aiIcon:  { fontSize: 20 },
  aiTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  aiMsg:   { fontSize: 12, color: '#555555', lineHeight: 17, fontStyle: 'italic' },
  aiArrow: { fontSize: 22, color: '#BDBDBD' },

  // ── Recent Activity ──
  recentHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  recentTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  viewAll:     { fontSize: 13, color: '#00897B', fontWeight: '600' },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
    borderRadius: 0,
  },
  txIconWrap: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  txIconText: { fontSize: 20 },
  txInfo:     { flex: 1, minWidth: 0 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 3 },
  txSubRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txSourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  txSourceIcon:  { fontSize: 9, color: '#9E9E9E' },
  txSourceText:  { fontSize: 11, color: '#9E9E9E' },
  txDot:         { fontSize: 11, color: '#CCCCCC' },
  txCat:         { fontSize: 11, color: '#9E9E9E' },
  txRight:       { alignItems: 'flex-end', gap: 3 },
  txAmount:      { fontSize: 14, fontWeight: '700', color: '#E53935' },
  txTime:        { fontSize: 10, color: '#BDBDBD' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  emptyText:  { fontSize: 13, color: '#9E9E9E', textAlign: 'center', lineHeight: 20 },

  // ── Quick Entry Modal ──
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
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  modalSub:   { fontSize: 13, color: '#9E9E9E', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14,
    color: '#1A1A1A', fontSize: 15, minHeight: 80,
    textAlignVertical: 'top', marginBottom: 12,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  exampleChip: {
    backgroundColor: '#E0F2F1', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  exampleChipText: { fontSize: 12, color: '#00897B', fontWeight: '500' },
  entryError:      { color: '#E53935', fontSize: 12, marginBottom: 12 },
  modalActions:    { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  cancelBtnText: { color: '#666666', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: '#00897B', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
