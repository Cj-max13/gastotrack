/**
 * AnalyticsScreen.js
 * Spending Breakdown (donut chart), Daily Trends (line chart),
 * Gasto AI Insight card, and Highest Expenditure list.
 * Matches the clean light-theme mockup.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, Animated, Easing,
} from 'react-native';
import { PieChart, LineChart } from 'react-native-chart-kit';
import { getTransactions, getInsights } from '../Services/api';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const CHART_W = width - 32;

// ── Category config ───────────────────────────────────────────────────────────
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
const CAT_LABELS = {
  food:          'Food & Drinks',
  transport:     'Transport',
  entertainment: 'Entertainment',
  shopping:      'Shopping',
  bills:         'Bills & Utilities',
  health:        'Health',
  savings:       'Savings',
  other:         'Other',
};

const PERIODS = ['Day', 'Week', 'Month'];

// ── Filter by period ──────────────────────────────────────────────────────────
function filterByPeriod(txList, period) {
  const now = new Date();
  return txList.filter(t => {
    const d = new Date(t.created_at);
    if (period === 'Day') {
      return d.toDateString() === now.toDateString();
    }
    if (period === 'Week') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return d >= start;
    }
    // Month
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
}

// ── Build last-7-days line chart data ─────────────────────────────────────────
function buildDailyTrend(txList) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const now  = new Date();
  const data = Array(7).fill(0);

  txList.forEach(t => {
    const d    = new Date(t.created_at);
    const diff = Math.floor((now - d) / 86400000);
    if (diff >= 0 && diff < 7) {
      // Map to Mon-Sun order
      const dayIdx = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
      data[dayIdx] += parseFloat(t.amount || 0);
    }
  });

  return { labels: days, datasets: [{ data: data.map(v => Math.round(v)) }] };
}

// ── Gasto Mini (same as BudgetScreen) ────────────────────────────────────────
function GastoMini({ talking = false }) {
  const blinkL    = useRef(new Animated.Value(1)).current;
  const blinkR    = useRef(new Animated.Value(1)).current;
  const mouthOpen = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    const blink = () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(blinkL, { toValue: 0.05, duration: 60, useNativeDriver: true }),
          Animated.timing(blinkL, { toValue: 1,    duration: 60, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(blinkR, { toValue: 0.05, duration: 60, useNativeDriver: true }),
          Animated.timing(blinkR, { toValue: 1,    duration: 60, useNativeDriver: true }),
        ]),
      ]).start(() => setTimeout(blink, 2000 + Math.random() * 2500));
    };
    const t = setTimeout(blink, 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (talking) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(mouthOpen, { toValue: 1,    duration: 180, useNativeDriver: true }),
        Animated.timing(mouthOpen, { toValue: 0.15, duration: 180, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(mouthOpen, { toValue: 0.15, duration: 100, useNativeDriver: true }).start();
    }
  }, [talking]);

  return (
    <View style={styles.gastoWrap}>
      <View style={styles.gastoBody}>
        <View style={styles.gastoEyeRow}>
          {[blinkL, blinkR].map((blink, i) => (
            <View key={i} style={styles.gastoEyeOuter}>
              <Animated.View style={[styles.gastoEyePupil, { transform: [{ scaleY: blink }] }]} />
              <View style={styles.gastoEyeShine} />
            </View>
          ))}
        </View>
        <View style={styles.gastoCheekRow}>
          <View style={styles.gastoCheek} />
          <View style={styles.gastoCheek} />
        </View>
        <View style={styles.gastoMouthWrap}>
          <Animated.View style={[styles.gastoMouth, { transform: [{ scaleY: mouthOpen }] }]} />
        </View>
      </View>
      <View style={styles.gastoAntenna}>
        <View style={styles.gastoAntennaLine} />
        <View style={styles.gastoAntennaBall} />
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AnalyticsScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [insights, setInsights]         = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [period, setPeriod]             = useState('Week');
  const [gastoTalking, setGastoTalking] = useState(false);
  const talkTimer = useRef(null);

  const load = async () => {
    try {
      const res    = await getTransactions({ limit: 200 });
      const txList = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setTransactions(txList);

      if (txList.length > 0) {
        try {
          const aiRes = await getInsights(txList);
          setInsights(aiRes.data);
          // Make Gasto talk when insights load
          clearTimeout(talkTimer.current);
          setGastoTalking(true);
          talkTimer.current = setTimeout(() => setGastoTalking(false), 5000);
        } catch { setInsights(null); }
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);

  const total = useMemo(
    () => filtered.reduce((s, t) => s + parseFloat(t.amount || 0), 0),
    [filtered]
  );

  const catTotals = useMemo(() => {
    const acc = {};
    filtered.forEach(t => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0);
    });
    return acc;
  }, [filtered]);

  const avg = filtered.length ? total / filtered.length : 0;

  // Top merchants
  const topMerchants = useMemo(() => {
    const acc = {};
    filtered.forEach(t => {
      acc[t.merchant] = (acc[t.merchant] || 0) + parseFloat(t.amount || 0);
    });
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([merchant, amount]) => ({ merchant, amount }));
  }, [filtered]);

  // Donut chart data
  const donutData = useMemo(() =>
    Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => ({
        name:  CAT_LABELS[cat] || cat,
        amount: Math.round(amt),
        color: CAT_COLORS[cat] || '#888',
        legendFontColor: '#555',
        legendFontSize: 12,
      })),
    [catTotals]
  );

  // Line chart
  const trendData = useMemo(() => buildDailyTrend(transactions), [transactions]);

  // Gasto insight message
  const gastoInsight = useMemo(() => {
    if (!insights) return null;
    const alerts = insights.overspending_alerts || [];
    const suggestions = insights.suggestions || [];
    if (alerts.length > 0) return alerts[0].message;
    if (suggestions.length > 0) return suggestions[0];
    return `You've spent ₱${Math.round(total).toLocaleString('en-PH')} this ${period.toLowerCase()}. Keep tracking!`;
  }, [insights, total, period]);

  // Week-over-week comparison (mock % for now)
  const weekChange = useMemo(() => {
    const thisWeek = filterByPeriod(transactions, 'Week').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    return thisWeek > 0 ? '+12%' : '0%'; // simplified
  }, [transactions]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00897B" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00897B" />}
    >
      {/* ── Period selector ── */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodChip, period === p && styles.periodChipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Spending Breakdown ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending Breakdown</Text>

        {donutData.length > 0 ? (
          <>
            {/* Donut chart using PieChart with hasLegend=false */}
            <View style={styles.donutWrap}>
              <PieChart
                data={donutData}
                width={CHART_W - 32}
                height={180}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0,137,123,${opacity})`,
                }}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="60"
                hasLegend={false}
                absolute={false}
              />
              {/* Center label */}
              <View style={styles.donutCenter} pointerEvents="none">
                <Text style={styles.donutAmount}>
                  ₱{Math.round(total).toLocaleString('en-PH')}
                </Text>
                <Text style={styles.donutLabel}>TOTAL</Text>
              </View>
            </View>

            {/* Legend */}
            <View style={styles.legendList}>
              {donutData.map((item, i) => (
                <View key={i} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendName}>{item.name}</Text>
                  <Text style={styles.legendAmt}>
                    ₱{item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>No spending data for this period</Text>
          </View>
        )}
      </View>

      {/* ── Daily Trends ── */}
      <View style={styles.card}>
        <View style={styles.trendHeader}>
          <View>
            <Text style={styles.cardTitle}>Daily Trends</Text>
            <Text style={styles.trendSub}>Avg. ₱{Math.round(avg).toLocaleString('en-PH')} / day</Text>
          </View>
          <View style={styles.trendBadge}>
            <Text style={styles.trendBadgeText}>↑ {weekChange} vs last week</Text>
          </View>
        </View>

        {trendData.datasets[0].data.some(v => v > 0) ? (
          <LineChart
            data={trendData}
            width={CHART_W - 32}
            height={160}
            fromZero
            chartConfig={{
              backgroundColor:         '#FFFFFF',
              backgroundGradientFrom:  '#FFFFFF',
              backgroundGradientTo:    '#FFFFFF',
              decimalPlaces:           0,
              color:  (opacity = 1) => `rgba(0,137,123,${opacity})`,
              labelColor: () => '#9E9E9E',
              propsForDots: { r: '4', strokeWidth: '2', stroke: '#00897B' },
              propsForBackgroundLines: { stroke: '#F0F0F0' },
            }}
            bezier
            style={{ borderRadius: 8, marginTop: 8 }}
            withInnerLines
            withOuterLines={false}
          />
        ) : (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyChartText}>No daily data available</Text>
          </View>
        )}

        {/* ── Gasto Insight ── */}
        {gastoInsight && (
          <TouchableOpacity
            style={styles.gastoInsightRow}
            onPress={() => {
              clearTimeout(talkTimer.current);
              setGastoTalking(true);
              talkTimer.current = setTimeout(() => setGastoTalking(false), 5000);
            }}
            activeOpacity={0.8}
          >
            <GastoMini talking={gastoTalking} />
            <View style={styles.gastoInsightText}>
              <Text style={styles.gastoInsightLabel}>Gasto Insight</Text>
              <Text style={styles.gastoInsightMsg} numberOfLines={2}>{gastoInsight}</Text>
            </View>
            <Text style={styles.gastoInsightArrow}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Highest Expenditure ── */}
      {topMerchants.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Highest Expenditure</Text>
          {topMerchants.map((item, i) => {
            // Find category for this merchant from transactions
            const tx  = filtered.find(t => t.merchant === item.merchant);
            const cat = tx?.category || 'other';
            const maxAmt = topMerchants[0].amount;
            const pct = maxAmt > 0 ? (item.amount / maxAmt) * 100 : 0;

            return (
              <View key={i} style={styles.merchantRow}>
                <View style={[styles.merchantIcon, { backgroundColor: (CAT_COLORS[cat] || '#888') + '20' }]}>
                  <Text style={styles.merchantIconText}>{CAT_ICONS[cat] || '📦'}</Text>
                </View>
                <View style={styles.merchantInfo}>
                  <Text style={styles.merchantName} numberOfLines={1}>{item.merchant}</Text>
                  <Text style={styles.merchantAmt}>
                    ₱{item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Text>
                  <View style={styles.merchantBarBg}>
                    <View style={[
                      styles.merchantBarFill,
                      { width: `${pct}%`, backgroundColor: CAT_COLORS[cat] || '#00897B' }
                    ]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── AI Suggestions ── */}
      {insights?.suggestions?.length > 0 && (
        <View style={styles.card}>
          <View style={styles.suggestionHeader}>
            <GastoMini talking={false} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardTitle}>Gasto's Tips</Text>
              <Text style={styles.trendSub}>Personalized for you</Text>
            </View>
          </View>
          {insights.suggestions.map((s, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{s}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F9FA' },
  inner:       { padding: 16, paddingTop: 8 },
  centered:    { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },

  // ── Period selector ──
  periodRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderRadius: 12, padding: 4, marginBottom: 16,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  periodChip: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
  },
  periodChipActive:    { backgroundColor: '#00897B' },
  periodChipText:      { fontSize: 13, fontWeight: '600', color: '#9E9E9E' },
  periodChipTextActive:{ color: '#FFFFFF' },

  // ── Card ──
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#EEEEEE',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },

  // ── Donut ──
  donutWrap:   { alignItems: 'center', position: 'relative' },
  donutCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  donutAmount: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  donutLabel:  { fontSize: 10, color: '#9E9E9E', letterSpacing: 1, fontWeight: '600' },

  // ── Legend ──
  legendList: { marginTop: 12 },
  legendRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  legendDot:  { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendName: { flex: 1, fontSize: 13, color: '#1A1A1A', fontWeight: '500' },
  legendAmt:  { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },

  // ── Trend ──
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  trendSub:    { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  trendBadge:  { backgroundColor: '#E0F2F1', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  trendBadgeText: { fontSize: 11, color: '#00897B', fontWeight: '600' },

  // ── Gasto Insight row ──
  gastoInsightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12,
    marginTop: 12, borderWidth: 1, borderColor: '#EEEEEE',
  },
  gastoInsightText:  { flex: 1 },
  gastoInsightLabel: { fontSize: 10, fontWeight: '700', color: '#00897B', letterSpacing: 0.5, marginBottom: 2 },
  gastoInsightMsg:   { fontSize: 13, color: '#1A1A1A', lineHeight: 18 },
  gastoInsightArrow: { fontSize: 20, color: '#BDBDBD' },

  // ── Merchants ──
  merchantRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  merchantIcon:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  merchantIconText: { fontSize: 18 },
  merchantInfo:     { flex: 1 },
  merchantName:     { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  merchantAmt:      { fontSize: 13, color: '#555555', marginBottom: 4 },
  merchantBarBg:    { height: 4, backgroundColor: '#F0F0F0', borderRadius: 2, overflow: 'hidden' },
  merchantBarFill:  { height: 4, borderRadius: 2 },

  // ── Gasto Tips ──
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tipRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  tipDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00897B', marginTop: 6 },
  tipText: { flex: 1, fontSize: 13, color: '#555555', lineHeight: 20 },

  // ── Empty ──
  emptyChart:     { alignItems: 'center', paddingVertical: 24 },
  emptyChartText: { fontSize: 13, color: '#BDBDBD' },

  // ── Gasto character ──
  gastoWrap: { alignItems: 'center' },
  gastoBody: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#00BFA5',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(0,137,123,0.3)',
  },
  gastoEyeRow:   { flexDirection: 'row', gap: 7, marginBottom: 3 },
  gastoEyeOuter: {
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  gastoEyePupil: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#1A1A1A' },
  gastoEyeShine: { position: 'absolute', top: 1, right: 1, width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  gastoCheekRow: { flexDirection: 'row', gap: 12, marginBottom: 2 },
  gastoCheek:    { width: 6, height: 4, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  gastoMouthWrap:{ alignItems: 'center' },
  gastoMouth: {
    width: 14, height: 7, borderRadius: 7,
    borderWidth: 1.5, borderColor: '#1A1A1A',
    borderTopWidth: 0, backgroundColor: 'transparent',
  },
  gastoAntenna:     { alignItems: 'center', marginBottom: -2 },
  gastoAntennaLine: { width: 2, height: 6, backgroundColor: 'rgba(0,137,123,0.4)' },
  gastoAntennaBall: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#C8F135' },
});
