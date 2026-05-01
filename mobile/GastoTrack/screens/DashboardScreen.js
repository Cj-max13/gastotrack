import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, ActivityIndicator, Animated,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { getTransactions, getInsights, resetCategorySpending, getCategoryOffsets } from '../Services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

const { width } = Dimensions.get('window');

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

export default function DashboardScreen({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [insights, setInsights]         = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);
  const [resetting, setResetting]       = useState(null); // category being reset
  const { alertProps, showAlert }       = useCustomAlert();

  // ── Animations ──
  const heroScale   = useRef(new Animated.Value(0.92)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const listAnim    = useRef(new Animated.Value(20)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    heroScale.setValue(0.92);
    heroOpacity.setValue(0);
    listAnim.setValue(20);
    listOpacity.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(heroScale,   { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(heroOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(listAnim,    { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(listOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const load = async () => {
    try {
      setError(null);
      const res = await getTransactions();
      const txList = res.data;
      setTransactions(txList);

      // Fetch AI insights if there are transactions
      if (txList.length > 0) {
        try {
          const stored  = await AsyncStorage.getItem('budgets');
          const budgets = stored ? JSON.parse(stored) : null;
          // Fetch reset offsets so insights reflect reset spending
          let category_offsets = null;
          try {
            const offsetRes = await getCategoryOffsets();
            category_offsets = offsetRes.data;
          } catch { /* ignore if offline */ }
          const aiRes = await getInsights(txList, budgets, category_offsets);
          setInsights(aiRes.data);
        } catch {
          setInsights(null);
        }
      }
    } catch (e) {
      setError('Cannot connect to server.\nMake sure npm run dev is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      animateIn();
    }
  };

  // Auto-reload every time this screen comes into focus
  // (e.g. after adding a transaction and navigating back)
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

  const handleReset = (category, spent) => {
    showAlert({
      icon: '🔄',
      title: `Reset ${category}?`,
      message: `Your ${category} spending of ₱${spent.toLocaleString()} will be reset to ₱0.\n\nYour transactions are kept — only the displayed amount resets.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(category);
            try {
              await resetCategorySpending(category, spent);
              setLoading(true);
              load();
            } catch {
              showAlert({
                icon: '❌',
                title: 'Reset Failed',
                message: 'Could not reset spending. Make sure the backend is running.',
              });
            } finally {
              setResetting(null);
            }
          },
        },
      ],
    });
  };

  const total = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const avg = transactions.length ? total / transactions.length : 0;

  const catTotals = transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0);
    return acc;
  }, {});

  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const chartLabels = Object.keys(catTotals);
  const chartData = Object.values(catTotals);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#C8F135" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8F135" />}
    >
      <CustomAlert {...alertProps} />
      {/* HERO CARD */}
      <Animated.View style={{ transform: [{ scale: heroScale }], opacity: heroOpacity }}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>TOTAL SPENT</Text>
          <Text style={styles.heroAmount}>
            ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{transactions.length}</Text>
              <Text style={styles.heroStatLbl}>Transactions</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>₱{Math.round(avg).toLocaleString()}</Text>
              <Text style={styles.heroStatLbl}>Avg spend</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{topCat ? CAT_ICONS[topCat[0]] + ' ' + topCat[0] : '—'}</Text>
              <Text style={styles.heroStatLbl}>Top category</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: listOpacity, transform: [{ translateY: listAnim }] }}>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* CHART */}
      {chartLabels.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPENDING BY CATEGORY</Text>
          <View style={styles.chartCard}>
            <BarChart
              data={{
                labels: chartLabels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{ data: chartData }],
              }}
              width={width - 64}
              height={180}
              fromZero
              chartConfig={{
                backgroundColor: '#181818',
                backgroundGradientFrom: '#181818',
                backgroundGradientTo: '#181818',
                decimalPlaces: 0,
                color: () => '#C8F135',
                labelColor: () => '#9A9A92',
                barPercentage: 0.6,
                propsForBackgroundLines: { stroke: '#2A2A2A' },
              }}
              style={{ borderRadius: 12 }}
              showValuesOnTopOfBars
              withInnerLines={true}
            />
          </View>
        </View>
      )}

      {/* CATEGORY PILLS */}
      {Object.keys(catTotals).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BREAKDOWN</Text>
          <View style={styles.pillsRow}>
            {Object.entries(catTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => (
                <View key={cat} style={[styles.pill, { borderColor: CAT_COLORS[cat] + '40' }]}>
                  <View style={[styles.pillDot, { backgroundColor: CAT_COLORS[cat] }]} />
                  <Text style={styles.pillIcon}>{CAT_ICONS[cat]}</Text>
                  <View>
                    <Text style={styles.pillName}>{cat}</Text>
                    <Text style={[styles.pillAmt, { color: CAT_COLORS[cat] }]}>
                      ₱{Math.round(amt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        </View>
      )}

      {/* AI INSIGHTS */}
      {insights && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INSIGHTS</Text>

          {/* Overspending Alerts */}
          {insights.overspending_alerts?.map((alert, i) => (
            <View key={i} style={styles.alertBox}>
              <Text style={styles.alertText}>🚨 {alert.message}</Text>
            </View>
          ))}

          {/* Budget Status */}
          {Object.entries(insights.budget_status || {}).map(([cat, info]) => (
            <View key={cat} style={[
              styles.budgetRow,
              info.status === 'over' && styles.budgetRowOver,
            ]}>
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetCat}>
                  {CAT_ICONS[cat] || '📦'} {cat}
                </Text>
                <Text style={[
                  styles.budgetPct,
                  info.status === 'over'    && { color: '#FF6B6B' },
                  info.status === 'warning' && { color: '#FFE66D' },
                  info.status === 'ok'      && { color: '#C8F135' },
                ]}>
                  {info.percentage_used}%
                </Text>
              </View>
              <View style={styles.budgetBarBg}>
                <View style={[
                  styles.budgetBarFill,
                  {
                    width: `${Math.min(info.percentage_used, 100)}%`,
                    backgroundColor:
                      info.status === 'over'    ? '#FF6B6B' :
                      info.status === 'warning' ? '#FFE66D' : '#C8F135',
                  },
                ]} />
              </View>
              <View style={styles.budgetFooter}>
                <Text style={styles.budgetSub}>
                  ₱{info.spent.toLocaleString()} / ₱{info.budget.toLocaleString()}
                </Text>
                {info.status === 'over' && (
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={() => handleReset(cat, info.spent)}
                    disabled={resetting === cat}
                  >
                    {resetting === cat ? (
                      <ActivityIndicator size="small" color="#FF6B6B" />
                    ) : (
                      <Text style={styles.resetBtnText}>🔄 Reset</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {/* Suggestions */}
          {insights.suggestions?.length > 0 && (
            <View style={styles.suggestionsBox}>
              <Text style={styles.suggestionsTitle}>💡 Suggestions</Text>
              {insights.suggestions.map((s, i) => (
                <Text key={i} style={styles.suggestionItem}>{s}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* RECENT TRANSACTIONS */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>No transactions yet.{'\n'}Tap + to add one!</Text>
          </View>
        ) : (
          transactions.slice(0, 5).map((tx, i) => (
            <View key={tx.id || i} style={styles.txItem}>
              <View style={[styles.txIcon, { backgroundColor: (CAT_COLORS[tx.category] || '#888') + '20' }]}>
                <Text style={styles.txIconText}>{CAT_ICONS[tx.category] || '📦'}</Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txMerchant}>{tx.merchant}</Text>
                <View style={[styles.txBadge, { backgroundColor: (CAT_COLORS[tx.category] || '#888') + '20' }]}>
                  <Text style={[styles.txBadgeText, { color: CAT_COLORS[tx.category] || '#888' }]}>
                    {tx.category}
                  </Text>
                </View>
              </View>
              <Text style={styles.txAmount}>₱{parseFloat(tx.amount).toLocaleString()}</Text>
            </View>
          ))
        )}
      </View>

      </Animated.View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  centered: { flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#9A9A92', marginTop: 12, fontSize: 14 },

  hero: {
    margin: 16,
    backgroundColor: '#C8F135',
    borderRadius: 20,
    padding: 24,
  },
  heroLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(0,0,0,0.5)', letterSpacing: 1.5 },
  heroAmount: { fontSize: 44, fontWeight: '700', color: '#0F0F0F', letterSpacing: -2, marginVertical: 8 },
  heroStats: { flexDirection: 'row', gap: 20, marginTop: 4 },
  heroStat: {},
  heroStatVal: { fontSize: 14, fontWeight: '700', color: '#0F0F0F' },
  heroStatLbl: { fontSize: 10, color: 'rgba(0,0,0,0.5)', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },

  errorBox: { margin: 16, backgroundColor: '#2A1515', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FF6B6B40' },
  errorText: { color: '#FF6B6B', fontSize: 13, lineHeight: 20, textAlign: 'center' },

  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: '#5A5A54', letterSpacing: 1.2, marginBottom: 12 },
  seeAll: { fontSize: 12, color: '#C8F135', fontWeight: '500' },

  chartCard: { backgroundColor: '#181818', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#222' },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#181818', borderRadius: 12, padding: 12,
    borderWidth: 1, minWidth: '45%', flex: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillIcon: { fontSize: 18 },
  pillName: { fontSize: 12, color: '#9A9A92', fontWeight: '500', textTransform: 'capitalize' },
  pillAmt: { fontSize: 14, fontWeight: '700', marginTop: 2 },

  txItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#181818', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#222',
  },
  txIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txIconText: { fontSize: 20 },
  txInfo: { flex: 1 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#F5F5F0', marginBottom: 4 },
  txBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  txBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#F5F5F0' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#5A5A54', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // ── AI Insights ──
  alertBox: {
    backgroundColor: '#2A1515', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#FF6B6B40',
  },
  alertText: { color: '#FF6B6B', fontSize: 13, lineHeight: 20 },

  budgetRow: {
    backgroundColor: '#181818', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#222',
  },
  budgetRowOver: {
    borderColor: '#FF6B6B40',
    backgroundColor: '#1A0A0A',
  },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetCat: { fontSize: 13, fontWeight: '600', color: '#F5F5F0', textTransform: 'capitalize' },
  budgetPct: { fontSize: 13, fontWeight: '700' },
  budgetBarBg: { height: 6, backgroundColor: '#2A2A2A', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  budgetBarFill: { height: 6, borderRadius: 3 },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetSub: { fontSize: 11, color: '#5A5A54' },
  resetBtn: {
    backgroundColor: '#2A1515', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#FF6B6B40',
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  resetBtnText: { fontSize: 11, color: '#FF6B6B', fontWeight: '600' },

  suggestionsBox: {
    backgroundColor: '#161f0a', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#C8F13530', marginTop: 4,
  },
  suggestionsTitle: { fontSize: 13, fontWeight: '600', color: '#C8F135', marginBottom: 10 },
  suggestionItem: { fontSize: 13, color: '#9A9A92', lineHeight: 22, marginBottom: 4 },
});
