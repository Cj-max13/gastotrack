import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

const DEFAULT_BUDGETS = {
  food: 3000,
  transport: 1500,
  entertainment: 1000,
  other: 2000,
};

const CAT_ICONS = {
  food: '🍔',
  transport: '🚗',
  entertainment: '🎬',
  other: '📦',
};

const CAT_COLORS = {
  food: '#FF6B6B',
  transport: '#4ECDC4',
  entertainment: '#FFE66D',
  other: '#A8A8A0',
};

export default function BudgetScreen() {
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const { alertProps, showAlert } = useCustomAlert();

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      const stored = await AsyncStorage.getItem('budgets');
      if (stored) {
        setBudgets(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load budgets', e);
    } finally {
      setLoading(false);
    }
  };

  const saveBudgets = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem('budgets', JSON.stringify(budgets));
      showAlert({ icon: '✅', title: 'Saved!', message: 'Your budget limits have been updated.' });
    } catch (e) {
      showAlert({ icon: '❌', title: 'Error', message: 'Failed to save budgets. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    showAlert({
      icon: '🔄',
      title: 'Reset to Defaults?',
      message: 'This will restore the original budget limits.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => setBudgets(DEFAULT_BUDGETS) },
      ],
    });
  };

  const updateBudget = (category, value) => {
    const numValue = parseInt(value.replace(/[^0-9]/g, ''), 10);
    setBudgets((prev) => ({
      ...prev,
      [category]: isNaN(numValue) ? 0 : numValue,
    }));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#C8F135" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <CustomAlert {...alertProps} />
      <Text style={styles.heading}>Budget Settings</Text>
      <Text style={styles.sub}>
        Set monthly spending limits for each category to track your budget health
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 How it works</Text>
        <Text style={styles.infoText}>
          • Set a monthly limit for each category{'\n'}
          • Dashboard shows warnings at 80% usage{'\n'}
          • Get alerts when you exceed your budget{'\n'}
          • AI provides personalized suggestions
        </Text>
      </View>

      {Object.entries(budgets).map(([category, amount]) => (
        <View key={category} style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <View style={styles.budgetTitleRow}>
              <Text style={styles.budgetIcon}>{CAT_ICONS[category]}</Text>
              <Text style={styles.budgetCategory}>{category}</Text>
            </View>
            <View style={[styles.budgetDot, { backgroundColor: CAT_COLORS[category] }]} />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.currencySymbol}>₱</Text>
            <TextInput
              style={styles.budgetInput}
              value={amount.toString()}
              onChangeText={(val) => updateBudget(category, val)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#5A5A54"
            />
            <Text style={styles.perMonth}>/ month</Text>
          </View>

          <View style={styles.budgetBarBg}>
            <View
              style={[
                styles.budgetBarFill,
                { width: '0%', backgroundColor: CAT_COLORS[category] },
              ]}
            />
          </View>
        </View>
      ))}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnSecondary} onPress={resetToDefaults}>
          <Text style={styles.btnSecondaryText}>Reset to Defaults</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={saveBudgets}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#0F0F0F" />
          ) : (
            <Text style={styles.btnPrimaryText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.defaultsBox}>
        <Text style={styles.defaultsTitle}>Default Budgets</Text>
        {Object.entries(DEFAULT_BUDGETS).map(([cat, amt]) => (
          <Text key={cat} style={styles.defaultsItem}>
            {CAT_ICONS[cat]} {cat}: ₱{amt.toLocaleString()}
          </Text>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  inner: { padding: 20, paddingTop: 24 },
  centered: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    justifyContent: 'center',
    alignItems: 'center',
  },

  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F5F5F0',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13,
    color: '#9A9A92',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },

  infoBox: {
    backgroundColor: '#161f0a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C8F13530',
    marginBottom: 24,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#C8F135', marginBottom: 10 },
  infoText: { fontSize: 13, color: '#9A9A92', lineHeight: 22 },

  budgetCard: {
    backgroundColor: '#181818',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  budgetIcon: { fontSize: 24 },
  budgetCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F0',
    textTransform: 'capitalize',
  },
  budgetDot: { width: 8, height: 8, borderRadius: 4 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C8F135',
    marginRight: 6,
  },
  budgetInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#F5F5F0',
    paddingVertical: 10,
  },
  perMonth: { fontSize: 12, color: '#5A5A54', marginLeft: 8 },

  budgetBarBg: {
    height: 4,
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  budgetBarFill: { height: 4, borderRadius: 2 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 24 },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '600', color: '#F5F5F0' },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#C8F135',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#0F0F0F' },

  defaultsBox: {
    backgroundColor: '#181818',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  defaultsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9A9A92',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  defaultsItem: { fontSize: 13, color: '#5A5A54', marginBottom: 4 },
});
