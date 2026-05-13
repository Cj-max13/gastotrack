/**
 * BudgetScreen.js — Redesigned with light theme matching the mockup.
 * Features:
 * - Gasto character with blinking eyes + animated mouth (reads the suggestion)
 * - "Gasto Budget Analysis" card replaces the old dark AI card
 * - Clean white category cards with colored progress bars
 * - Status labels: Over by ₱X | 85% Limit | Healthy
 * - Edit All button to update limits inline
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Animated, Easing, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBudget, updateBudgetLimits, updateMonthlyBudget } from '../Services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

// ── Category config ───────────────────────────────────────────────────────────
const CAT_ICONS = {
  food:          '🍔',
  transport:     '🚗',
  entertainment: '🎬',
  shopping:      '🛍️',
  bills:         '⚡',
  health:        '💊',
  savings:       '💰',
  other:         '📦',
};

const CAT_BG = {
  food:          '#FFEAEA',
  transport:     '#FFF3E0',
  entertainment: '#F3E5F5',
  shopping:      '#E8F5E9',
  bills:         '#E3F2FD',
  health:        '#FCE4EC',
  savings:       '#F9FBE7',
  other:         '#F5F5F5',
};

const CAT_ICON_COLOR = {
  food:          '#E53935',
  transport:     '#F57C00',
  entertainment: '#8E24AA',
  shopping:      '#43A047',
  bills:         '#1E88E5',
  health:        '#E91E63',
  savings:       '#7CB342',
  other:         '#757575',
};

// Progress bar colors by status
const BAR_COLORS = {
  over:      '#E53935',
  warning:   '#FF8F00',
  ok:        '#00897B',
  unlimited: '#BDBDBD',
};

// Status label text + color
function getStatusLabel(cat) {
  if (cat.status === 'over') {
    const over = parseFloat(cat.spent) - parseFloat(cat.budget_limit);
    return { text: `Over by ₱${over.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`, color: '#E53935' };
  }
  if (cat.status === 'warning') {
    return { text: `${cat.percentage}% Limit`, color: '#FF8F00' };
  }
  if (cat.status === 'unlimited' || !cat.budget_limit) {
    return { text: 'No limit', color: '#9E9E9E' };
  }
  return { text: 'Healthy', color: '#00897B' };
}

// ── Gasto Mini Character ──────────────────────────────────────────────────────
function GastoMini({ talking = false }) {
  const blinkL    = useRef(new Animated.Value(1)).current;
  const blinkR    = useRef(new Animated.Value(1)).current;
  const mouthOpen = useRef(new Animated.Value(0.15)).current;
  const bodyBob   = useRef(new Animated.Value(0)).current;

  // Blink loop
  useEffect(() => {
    const blink = () => {
      Animated.sequence([
        Animated.timing(blinkL, { toValue: 0.05, duration: 60, useNativeDriver: true }),
        Animated.timing(blinkL, { toValue: 1,    duration: 60, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(blinkR, { toValue: 0.05, duration: 60, useNativeDriver: true }),
        Animated.timing(blinkR, { toValue: 1,    duration: 60, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(blink, 2000 + Math.random() * 2500);
      });
    };
    const t = setTimeout(blink, 800);
    return () => clearTimeout(t);
  }, []);

  // Mouth animation when talking
  useEffect(() => {
    if (talking) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(mouthOpen, { toValue: 1,    duration: 180, useNativeDriver: true }),
          Animated.timing(mouthOpen, { toValue: 0.15, duration: 180, useNativeDriver: true }),
        ])
      );
      loop.start();
      // Gentle body bob while talking
      const bob = Animated.loop(
        Animated.sequence([
          Animated.timing(bodyBob, { toValue: -3, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bodyBob, { toValue:  3, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      bob.start();
      return () => { loop.stop(); bob.stop(); bodyBob.setValue(0); };
    } else {
      Animated.timing(mouthOpen, { toValue: 0.15, duration: 100, useNativeDriver: true }).start();
      bodyBob.setValue(0);
    }
  }, [talking]);

  const s = 1; // scale factor

  return (
    <Animated.View style={[styles.gastoWrap, { transform: [{ translateY: bodyBob }] }]}>
      {/* Body */}
      <View style={styles.gastoBody}>
        {/* Eyes row */}
        <View style={styles.gastoEyeRow}>
          {/* Left eye */}
          <View style={styles.gastoEyeOuter}>
            <Animated.View style={[styles.gastoEyePupil, { transform: [{ scaleY: blinkL }] }]} />
            <View style={styles.gastoEyeShine} />
          </View>
          {/* Right eye */}
          <View style={styles.gastoEyeOuter}>
            <Animated.View style={[styles.gastoEyePupil, { transform: [{ scaleY: blinkR }] }]} />
            <View style={styles.gastoEyeShine} />
          </View>
        </View>

        {/* Cheeks */}
        <View style={styles.gastoCheekRow}>
          <View style={styles.gastoCheek} />
          <View style={styles.gastoCheek} />
        </View>

        {/* Mouth */}
        <View style={styles.gastoMouthWrap}>
          <Animated.View style={[styles.gastoMouth, { transform: [{ scaleY: mouthOpen }] }]} />
        </View>
      </View>

      {/* Antenna */}
      <View style={styles.gastoAntenna}>
        <View style={styles.gastoAntennaLine} />
        <View style={styles.gastoAntennaBall} />
      </View>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BudgetScreen() {
  const [budgetData, setBudgetData]         = useState(null);
  const [editLimits, setEditLimits]         = useState({});
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [hasChanges, setHasChanges]         = useState(false);
  const [editMode, setEditMode]             = useState(false);
  const [gastoTalking, setGastoTalking]     = useState(false);
  const [suggestion, setSuggestion]         = useState('');

  // Monthly budget edit
  const [monthlyBudget, setMonthlyBudget]   = useState('');
  const [editingMonthly, setEditingMonthly] = useState(false);
  const [savingMonthly, setSavingMonthly]   = useState(false);

  const { alertProps, showAlert } = useCustomAlert();
  const talkTimer = useRef(null);

  const load = async () => {
    try {
      const res = await getBudget();
      setBudgetData(res.data);
      setMonthlyBudget(String(Math.round(parseFloat(res.data.monthly_budget || 10000))));
      const limits = {};
      res.data.categories.forEach(cat => {
        limits[cat.name] = String(cat.budget_limit);
      });
      setEditLimits(limits);
      setHasChanges(false);

      // Build Gasto's suggestion from budget status
      const cats = res.data.categories || [];
      const over    = cats.filter(c => c.status === 'over');
      const warning = cats.filter(c => c.status === 'warning');
      let msg = '';
      if (over.length > 0) {
        msg = `You've exceeded your ${over.map(c => c.name).join(' and ')} budget this month. Try to cut back on spending in ${over.length > 1 ? 'these categories' : 'this category'}.`;
      } else if (warning.length > 0) {
        msg = `You're close to your ${warning.map(c => c.name).join(' and ')} limit. Consider slowing down your spending there.`;
      } else {
        msg = `Great job! You're on track with all your budgets this month. Keep it up! 🎉`;
      }
      setSuggestion(msg);

      // Make Gasto talk for a few seconds when data loads
      clearTimeout(talkTimer.current);
      setGastoTalking(true);
      talkTimer.current = setTimeout(() => setGastoTalking(false), Math.min(msg.length * 60, 8000));
    } catch {
      showAlert({ icon: '❌', title: 'Connection Error', message: 'Could not load budget data.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const handleLimitChange = (category, value) => {
    setEditLimits(prev => ({ ...prev, [category]: value.replace(/[^0-9]/g, '') }));
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
      setEditMode(false);
      await load();
      showAlert({ icon: '✅', title: 'Saved!', message: 'Budget limits updated.' });
    } catch (e) {
      showAlert({ icon: '❌', title: 'Save Failed', message: e.response?.data?.error || 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMonthly = async () => {
    const num = parseFloat(monthlyBudget);
    if (isNaN(num) || num < 0) {
      showAlert({ icon: '⚠️', title: 'Invalid Amount', message: 'Enter a valid budget amount.' });
      return;
    }
    setSavingMonthly(true);
    try {
      await updateMonthlyBudget(num);
      setEditingMonthly(false);
      await load();
    } catch (e) {
      showAlert({ icon: '❌', title: 'Update Failed', message: e.response?.data?.error || 'Could not update.' });
    } finally {
      setSavingMonthly(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00897B" />
        <Text style={styles.loadingText}>Loading budget...</Text>
      </View>
    );
  }

  const categories = budgetData?.categories || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00897B" />}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <CustomAlert {...alertProps} />

      {/* ── Gasto Budget Analysis Card ── */}
      <View style={styles.gastoCard}>
        <View style={styles.gastoCardLeft}>
          <GastoMini talking={gastoTalking} />
        </View>
        <View style={styles.gastoCardRight}>
          <View style={styles.gastoCardTitleRow}>
            <Text style={styles.gastoCardTitle}>Gasto</Text>
            <View style={[styles.gastoBadge, gastoTalking && styles.gastoBadgeTalking]}>
              <Text style={styles.gastoBadgeText}>{gastoTalking ? '● Speaking' : '● Ready'}</Text>
            </View>
          </View>
          <Text style={styles.gastoCardSubtitle}>Budget Analysis</Text>
          <Text style={styles.gastoCardMsg} numberOfLines={4}>{suggestion}</Text>
          <TouchableOpacity
            style={styles.gastoReplayBtn}
            onPress={() => {
              clearTimeout(talkTimer.current);
              setGastoTalking(true);
              talkTimer.current = setTimeout(() => setGastoTalking(false), Math.min(suggestion.length * 60, 8000));
            }}
          >
            <Text style={styles.gastoReplayBtnText}>▶ Read again</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Summary row ── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL BUDGETED</Text>
          <Text style={styles.summaryValue}>
            ₱{parseFloat(budgetData?.monthly_budget || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </Text>
          {!editingMonthly ? (
            <TouchableOpacity onPress={() => setEditingMonthly(true)}>
              <Text style={styles.editBudgetLink}>Edit ✏️</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.monthlyEditRow}>
              <TextInput
                style={styles.monthlyInput}
                value={monthlyBudget}
                onChangeText={v => setMonthlyBudget(v.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity style={styles.monthlyOkBtn} onPress={handleSaveMonthly} disabled={savingMonthly}>
                {savingMonthly
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.monthlyOkText}>OK</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingMonthly(false)}>
                <Text style={styles.monthlyCancelText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={[styles.summaryCard, styles.summaryCardRight]}>
          <Text style={styles.summaryLabel}>REMAINING</Text>
          <Text style={[
            styles.summaryValue,
            { color: budgetData?.overall_status === 'over' ? '#E53935' : '#00897B' }
          ]}>
            ₱{parseFloat(budgetData?.total_remaining || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.summaryPeriod}>{budgetData?.period}</Text>
        </View>
      </View>

      {/* ── Active Budgets header ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Active Budgets</Text>
        <TouchableOpacity onPress={() => setEditMode(v => !v)}>
          <Text style={styles.editAllBtn}>{editMode ? 'Done ✓' : 'Edit All ✏️'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Category cards ── */}
      {categories.map((cat) => {
        const pct       = Math.min(cat.percentage ?? 0, 100);
        const barColor  = BAR_COLORS[cat.status] || BAR_COLORS.ok;
        const statusLbl = getStatusLabel(cat);
        const iconBg    = CAT_BG[cat.name]        || '#F5F5F5';
        const iconColor = CAT_ICON_COLOR[cat.name] || '#757575';
        const editVal   = editLimits[cat.name] ?? String(cat.budget_limit);

        return (
          <View key={cat.name} style={styles.catCard}>
            {/* Icon */}
            <View style={[styles.catIconWrap, { backgroundColor: iconBg }]}>
              <Text style={styles.catIconText}>{CAT_ICONS[cat.name] || '📦'}</Text>
            </View>

            {/* Info */}
            <View style={styles.catInfo}>
              <View style={styles.catTopRow}>
                <Text style={styles.catName}>
                  {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                </Text>
                <Text style={[styles.catStatus, { color: statusLbl.color }]}>
                  {statusLbl.text}
                </Text>
              </View>

              {editMode ? (
                <View style={styles.catEditRow}>
                  <Text style={styles.catEditLabel}>₱</Text>
                  <TextInput
                    style={styles.catEditInput}
                    value={editVal}
                    onChangeText={v => handleLimitChange(cat.name, v)}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                  <Text style={styles.catEditLabel}>/ month</Text>
                </View>
              ) : (
                <Text style={styles.catSpend}>
                  ₱{parseFloat(cat.spent || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} / ₱{parseFloat(cat.budget_limit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} used
                </Text>
              )}

              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
            </View>
          </View>
        );
      })}

      {/* ── Save button (edit mode) ── */}
      {editMode && (
        <TouchableOpacity
          style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.saveBtnText}>{hasChanges ? 'Save Changes' : 'No Changes'}</Text>
          }
        </TouchableOpacity>
      )}

      {/* ── Tip ── */}
      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          💡 Tap <Text style={{ fontWeight: '700' }}>Edit All</Text> to update your monthly limits.
          Budgets reset on the 1st of each month.
        </Text>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F9FA' },
  inner:       { padding: 16, paddingTop: 16 },
  centered:    { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },

  // ── Gasto card ──
  gastoCard: {
    backgroundColor: '#004D40',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', gap: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gastoCardLeft:  { justifyContent: 'center', alignItems: 'center', width: 80 },
  gastoCardRight: { flex: 1 },
  gastoCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  gastoCardTitle:    { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  gastoBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  gastoBadgeTalking: { backgroundColor: 'rgba(200,241,53,0.25)' },
  gastoBadgeText:    { fontSize: 9, color: '#FFFFFF', fontWeight: '600' },
  gastoCardSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  gastoCardMsg:      { fontSize: 13, color: '#FFFFFF', lineHeight: 19, marginBottom: 10 },
  gastoReplayBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  gastoReplayBtnText: { fontSize: 11, color: '#C8F135', fontWeight: '600' },

  // ── Gasto character ──
  gastoWrap: { alignItems: 'center' },
  gastoBody: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#00BFA5',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#00BFA5', shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
  },
  gastoEyeRow:   { flexDirection: 'row', gap: 10, marginBottom: 4 },
  gastoEyeOuter: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  gastoEyePupil: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#1A1A1A' },
  gastoEyeShine: {
    position: 'absolute', top: 2, right: 2,
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF',
  },
  gastoCheekRow: { flexDirection: 'row', gap: 18, marginBottom: 3 },
  gastoCheek:    { width: 8, height: 5, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  gastoMouthWrap:{ alignItems: 'center' },
  gastoMouth: {
    width: 20, height: 10, borderRadius: 10,
    borderWidth: 2, borderColor: '#1A1A1A',
    borderTopWidth: 0, backgroundColor: 'transparent',
  },
  gastoAntenna: { alignItems: 'center', marginBottom: -2 },
  gastoAntennaLine: { width: 2, height: 8, backgroundColor: 'rgba(255,255,255,0.5)' },
  gastoAntennaBall: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C8F135' },

  // ── Summary row ──
  summaryRow:      { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#EEEEEE',
  },
  summaryCardRight: {},
  summaryLabel:  { fontSize: 10, fontWeight: '700', color: '#9E9E9E', letterSpacing: 0.8, marginBottom: 6 },
  summaryValue:  { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  summaryPeriod: { fontSize: 10, color: '#BDBDBD', marginTop: 2 },
  editBudgetLink:{ fontSize: 11, color: '#1A73E8', fontWeight: '600', marginTop: 2 },
  monthlyEditRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  monthlyInput:  { flex: 1, fontSize: 14, fontWeight: '700', color: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#1A73E8', paddingVertical: 2 },
  monthlyOkBtn:  { backgroundColor: '#1A73E8', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  monthlyOkText: { fontSize: 11, color: '#FFFFFF', fontWeight: '700' },
  monthlyCancelText: { fontSize: 14, color: '#9E9E9E', paddingHorizontal: 4 },

  // ── Section header ──
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  editAllBtn:    { fontSize: 13, color: '#1A73E8', fontWeight: '600' },

  // ── Category card ──
  catCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderColor: '#EEEEEE',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  catIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  catIconText: { fontSize: 20 },
  catInfo:     { flex: 1 },
  catTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  catName:     { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  catStatus:   { fontSize: 13, fontWeight: '600' },
  catSpend:    { fontSize: 12, color: '#757575', marginBottom: 8 },
  catEditRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  catEditLabel:{ fontSize: 13, color: '#757575' },
  catEditInput:{
    flex: 1, fontSize: 15, fontWeight: '700', color: '#1A1A1A',
    borderBottomWidth: 1, borderBottomColor: '#1A73E8', paddingVertical: 2,
  },
  progressBg:   { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },

  // ── Save button ──
  saveBtn: {
    backgroundColor: '#1A73E8', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 4, marginBottom: 16,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // ── Tip ──
  tipBox: {
    backgroundColor: '#E8F5E9', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#C8E6C9',
  },
  tipText: { fontSize: 12, color: '#388E3C', lineHeight: 18 },
});
