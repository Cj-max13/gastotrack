/**
 * BudgetScreen.js
 * Shows per-category budget limits with real spending data from the backend.
 * Connects to GET /budget and PUT /budget.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBudget, updateBudgetLimits, updateMonthlyBudget } from '../Services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

// All 8 categories from the schema
const ALL_CATEGORIES = ['food', 'transport', 'entertainment', 'shopping', 'bills', 'health', 'savings', 'other'];

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

// Status badge colors
const STATUS_COLORS = { ok: '#C8F135', warning: '#FFE66D', over: '#FF6B6B', unlimited: '#5A5A54' };
const STATUS_LABELS = { ok: 'On track', warning: '80%+ used', over: 'Over budget', unlimited: 'No limit' };

export default function BudgetScreen() {
  const [budgetData, setBudgetData]       = useState(null);
  const [editLimits, setEditLimits]       = useState({});
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [hasChanges, setHasChanges]       = useState(false);

  // Monthly budget edit state
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [savingMonthly, setSavingMonthly] = useState(false);

  const { alertProps, showAlert }         = useCustomAlert();

  const load = async () => {
    try {
      const res = await getBudget();
      setBudgetData(res.data);
      // Populate monthly budget field
      setMonthlyBudget(String(Math.round(parseFloat(res.data.monthly_budget || 10000))));
      // Populate category limit edit state
      const limits = {};
      res.data.categories.forEach(cat => {
        limits[cat.name] = String(cat.budget_limit);
      });
      setEditLimits(limits);
      setHasChanges(false);
    } catch (e) {
      showAlert({
        icon: '❌',
        title: 'Connection Error',
        message: 'Could not load budget data.\nMake sure the backend is running.',
      });
    } finally {
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

  const handleLimitChange = (category, value) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    setEditLimits(prev => ({ ...prev, [category]: cleaned }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      Object.entries(editLimits).forEach(([cat, val]) => {
        const num = parseFloat(val);
        if (!isNaN(num) && num >= 0) payload[cat] = num;
      });
      await updateBudgetLimits(payload);
      setHasChanges(false);
      await load();
      showAlert({ icon: '✅', title: 'Saved!', message: 'Budget limits updated successfully.' });
    } catch (e) {
      showAlert({
        icon: '❌',
        title: 'Save Failed',
        message: e.response?.data?.error || 'Could not save budget limits.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMonthly = async () => {
    const num = parseFloat(monthlyBudget);
    if (isNaN(num) || num < 0) {
      showAlert({ icon: '⚠️', title: 'Invalid Amount', message: 'Please enter a valid budget amount.' });
      return;
    }
    setSavingMonthly(true);
    try {
      await updateMonthlyBudget(num);
      setEditingMonthly(false);
      await load();
      showAlert({ icon: '✅', title: 'Updated!', message: `Monthly budget set to ₱${num.toLocaleString('en-PH')}.` });
    } catch (e) {
      showAlert({
        icon: '❌',
        title: 'Update Failed',
        message: e.response?.data?.error || 'Could not update monthly budget.',
      });
    } finally {
      setSavingMonthly(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#C8F135" />
        <Text style={styles.loadingText}>Loading budget...</Text>
      </View>
    );
  }

  const categories = budgetData?.categories || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8F135" />}
    >
      <CustomAlert {...alertProps} />

      {/* ── Monthly budget editor ── */}
      <View style={styles.monthlyCard}>
        <View style={styles.monthlyHeader}>
          <Text style={styles.monthlyTitle}>💰 Monthly Budget</Text>
          {!editingMonthly ? (
            <TouchableOpacity
              style={styles.editMonthlyBtn}
              onPress={() => setEditingMonthly(true)}
            >
              <Text style={styles.editMonthlyBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cancelMonthlyBtn}
              onPress={() => {
                setEditingMonthly(false);
                setMonthlyBudget(String(Math.round(parseFloat(budgetData?.monthly_budget || 10000))));
              }}
            >
              <Text style={styles.cancelMonthlyBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {editingMonthly ? (
          <View style={styles.monthlyEditRow}>
            <View style={styles.monthlyInputWrap}>
              <Text style={styles.monthlyPeso}>₱</Text>
              <TextInput
                style={styles.monthlyInput}
                value={monthlyBudget}
                onChangeText={v => setMonthlyBudget(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="10000"
                placeholderTextColor="#5A5A54"
                autoFocus
                selectTextOnFocus
              />
            </View>
            <TouchableOpacity
              style={styles.saveMonthlyBtn}
              onPress={handleSaveMonthly}
              disabled={savingMonthly}
            >
              {savingMonthly
                ? <ActivityIndicator size="small" color="#0F0F0F" />
                : <Text style={styles.saveMonthlyBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.monthlyValue}>
            ₱{parseFloat(budgetData?.monthly_budget || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
            <Text style={styles.monthlyValueSub}> / month</Text>
          </Text>
        )}

        <Text style={styles.monthlyHint}>
          This is your total spending cap for the month across all categories.
        </Text>
      </View>

      {/* ── Overall summary card ── */}
      {budgetData && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>
                ₱{parseFloat(budgetData.total_spent || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.summaryLabel}>Spent this month</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={[
                styles.summaryValue,
                budgetData.overall_status === 'over'    && { color: '#FF6B6B' },
                budgetData.overall_status === 'warning' && { color: '#FFE66D' },
              ]}>
                {budgetData.overall_percentage ?? '—'}%
              </Text>
              <Text style={styles.summaryLabel}>Used</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text style={[
                styles.summaryValue,
                { color: budgetData.overall_status === 'over' ? '#FF6B6B' : '#C8F135' }
              ]}>
                ₱{parseFloat(budgetData.total_remaining || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}
              </Text>
              <Text style={styles.summaryLabel}>Remaining</Text>
            </View>
          </View>
          <Text style={styles.summaryPeriod}>{budgetData.period}</Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>CATEGORY LIMITS</Text>
      <Text style={styles.sectionSub}>Set ₱0 for no limit. Tap Save to apply changes.</Text>

      {/* ── Category cards ── */}
      {categories.map((cat) => {
        const color      = CAT_COLORS[cat.name] || '#888';
        const editVal    = editLimits[cat.name] ?? String(cat.budget_limit);
        const statusColor = STATUS_COLORS[cat.status] || '#5A5A54';
        const pct        = cat.percentage ?? 0;

        return (
          <View key={cat.name} style={[styles.catCard, { borderLeftColor: color }]}>
            {/* Header row */}
            <View style={styles.catHeader}>
              <Text style={styles.catIcon}>{cat.icon || CAT_ICONS[cat.name]}</Text>
              <Text style={styles.catName}>{cat.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '25', borderColor: statusColor + '60' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {STATUS_LABELS[cat.status] || cat.status}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            {cat.budget_limit > 0 && (
              <View style={styles.progressBg}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor:
                      cat.status === 'over'    ? '#FF6B6B' :
                      cat.status === 'warning' ? '#FFE66D' : color,
                  },
                ]} />
              </View>
            )}

            {/* Spending info */}
            <View style={styles.spendRow}>
              <Text style={styles.spentText}>
                ₱{parseFloat(cat.spent || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })} spent
              </Text>
              {cat.remaining !== null && (
                <Text style={styles.remainingText}>
                  ₱{parseFloat(cat.remaining).toLocaleString('en-PH', { maximumFractionDigits: 0 })} left
                </Text>
              )}
            </View>

            {/* Limit input */}
            <View style={styles.limitRow}>
              <Text style={styles.limitLabel}>Monthly limit</Text>
              <View style={styles.limitInputWrap}>
                <Text style={styles.pesoSign}>₱</Text>
                <TextInput
                  style={styles.limitInput}
                  value={editVal}
                  onChangeText={(v) => handleLimitChange(cat.name, v)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#5A5A54"
                  selectTextOnFocus
                />
              </View>
            </View>
          </View>
        );
      })}

      {/* ── Save button ── */}
      <TouchableOpacity
        style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving || !hasChanges}
      >
        {saving
          ? <ActivityIndicator color="#0F0F0F" />
          : <Text style={styles.saveBtnText}>
              {hasChanges ? 'Save Changes' : 'No Changes'}
            </Text>
        }
      </TouchableOpacity>

      {/* ── Info box ── */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 How budget alerts work</Text>
        <Text style={styles.infoText}>
          • <Text style={{ color: '#FFE66D' }}>Warning</Text> — 80% of limit reached{'\n'}
          • <Text style={{ color: '#FF6B6B' }}>Over budget</Text> — limit exceeded{'\n'}
          • Set limit to ₱0 to disable tracking for a category{'\n'}
          • Budgets reset on the 1st of each month
        </Text>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0F0F0F' },
  inner:       { padding: 16, paddingTop: 20 },
  centered:    { flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#9A9A92', marginTop: 12, fontSize: 14 },

  // ── Monthly budget card ──
  monthlyCard: {
    backgroundColor: '#181818', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#C8F13540', marginBottom: 16,
  },
  monthlyHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  monthlyTitle: { fontSize: 14, fontWeight: '700', color: '#F5F5F0' },
  editMonthlyBtn: {
    backgroundColor: '#1E2A0A', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#C8F13540',
  },
  editMonthlyBtnText: { fontSize: 12, color: '#C8F135', fontWeight: '600' },
  cancelMonthlyBtn: {
    backgroundColor: '#222', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#333',
  },
  cancelMonthlyBtnText: { fontSize: 12, color: '#9A9A92', fontWeight: '600' },
  monthlyValue: { fontSize: 32, fontWeight: '800', color: '#C8F135', letterSpacing: -1, marginBottom: 6 },
  monthlyValueSub: { fontSize: 14, fontWeight: '400', color: '#5A5A54' },
  monthlyHint: { fontSize: 11, color: '#3A3A3A', lineHeight: 16 },
  monthlyEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  monthlyInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F0F0F', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#C8F13560',
  },
  monthlyPeso: { fontSize: 22, fontWeight: '700', color: '#C8F135', marginRight: 6 },
  monthlyInput: { flex: 1, fontSize: 28, fontWeight: '700', color: '#F5F5F0' },
  saveMonthlyBtn: {
    backgroundColor: '#C8F135', borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 70,
  },
  saveMonthlyBtnText: { fontSize: 14, fontWeight: '700', color: '#0F0F0F' },

  // ── Summary card ──
  summaryCard: {
    backgroundColor: '#181818', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 24,
  },
  summaryRow:    { flexDirection: 'row', alignItems: 'center' },
  summaryStat:   { flex: 1, alignItems: 'center' },
  summaryValue:  { fontSize: 18, fontWeight: '700', color: '#C8F135' },
  summaryLabel:  { fontSize: 10, color: '#5A5A54', marginTop: 3, textAlign: 'center' },
  summaryDivider:{ width: 1, height: 36, backgroundColor: '#2A2A2A' },
  summaryPeriod: { fontSize: 11, color: '#5A5A54', textAlign: 'center', marginTop: 12 },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#5A5A54', letterSpacing: 1.2, marginBottom: 4 },
  sectionSub:   { fontSize: 12, color: '#3A3A3A', marginBottom: 16 },

  // ── Category card ──
  catCard: {
    backgroundColor: '#181818', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 12,
    borderLeftWidth: 3,
  },
  catHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catIcon:    { fontSize: 20 },
  catName:    { flex: 1, fontSize: 14, fontWeight: '600', color: '#F5F5F0', textTransform: 'capitalize' },
  statusBadge:{
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '600' },

  progressBg:   { height: 5, backgroundColor: '#2A2A2A', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: 5, borderRadius: 3 },

  spendRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  spentText:     { fontSize: 12, color: '#9A9A92' },
  remainingText: { fontSize: 12, color: '#5A5A54' },

  limitRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  limitLabel:    { fontSize: 12, color: '#5A5A54' },
  limitInputWrap:{
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0F0F0F', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2A2A2A',
    minWidth: 120,
  },
  pesoSign:   { fontSize: 16, fontWeight: '700', color: '#C8F135', marginRight: 4 },
  limitInput: { fontSize: 18, fontWeight: '700', color: '#F5F5F0', minWidth: 80 },

  saveBtn: {
    backgroundColor: '#C8F135', borderRadius: 14,
    padding: 18, alignItems: 'center', marginTop: 8, marginBottom: 20,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#0F0F0F' },

  infoBox: {
    backgroundColor: '#161f0a', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#C8F13530',
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#C8F135', marginBottom: 10 },
  infoText:  { fontSize: 13, color: '#9A9A92', lineHeight: 22 },
});
