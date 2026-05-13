/**
 * AddScreen.js — Light theme, matches the overall app design.
 * Natural language expense entry with live AI categorization preview.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Modal, Animated, StatusBar,
} from 'react-native';
import { postManualTransaction, previewCategorize } from '../Services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import { isOnline, addToQueue, addToCache } from '../Services/OfflineManager';

const EXAMPLES = [
  'Spent ₱150 at Jollibee',
  'Paid ₱500 at Netflix',
  'Grab ride ₱80',
  'Groceries ₱320 at SM Supermarket',
  'Paid ₱200 at Shell',
  'Medicine ₱450 at Mercury Drug',
  'Paid ₱999 at Shopee',
];

const CAT_ICONS  = { food:'🍴', transport:'🚗', entertainment:'🎬', health:'💊', shopping:'🛍️', bills:'⚡', savings:'💰', other:'📦' };
const CAT_COLORS = { food:'#00897B', transport:'#1E88E5', entertainment:'#8E24AA', health:'#E91E63', shopping:'#43A047', bills:'#00ACC1', savings:'#7CB342', other:'#757575' };
const CAT_BG     = { food:'#E0F2F1', transport:'#E3F2FD', entertainment:'#F3E5F5', health:'#FCE4EC', shopping:'#E8F5E9', bills:'#E0F7FA', savings:'#F9FBE7', other:'#F5F5F5' };

function isValidFormat(text) {
  return /₱\s?\d+/.test(text) && /\bat\s+[A-Za-z]/i.test(text);
}

function quickParse(text) {
  const amountMatch   = text.match(/₱\s?(\d+(\.\d+)?)/);
  const merchantMatch = text.match(/at ([A-Za-z0-9\s&'.,-]+?)(?:\s*$|\s+for\b|\s+worth\b)/i)
                     || text.match(/at ([A-Za-z0-9\s&'.,-]+)/i);
  return {
    amount:   amountMatch   ? parseFloat(amountMatch[1]) : null,
    merchant: merchantMatch ? merchantMatch[1].trim()    : null,
  };
}

export default function AddScreen({ navigation }) {
  const [text, setText]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [preview, setPreview]         = useState(null);
  const [previewing, setPreviewing]   = useState(false);
  const debounceRef = useRef(null);
  const { alertProps, showAlert } = useCustomAlert();

  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewY       = useRef(new Animated.Value(-8)).current;
  const btnScale       = useRef(new Animated.Value(1)).current;
  const entranceOpacity= useRef(new Animated.Value(0)).current;
  const entranceY      = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(entranceY,       { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (preview || previewing) {
      previewOpacity.setValue(0); previewY.setValue(-8);
      Animated.parallel([
        Animated.timing(previewOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(previewY,       { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [preview, previewing]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const { merchant } = quickParse(text);
    if (!merchant || !text.trim()) { setPreview(null); return; }
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await previewCategorize(merchant, text);
        setPreview({ merchant, amount: quickParse(text).amount, category: res.data.category, confidence: res.data.confidence });
      } catch {
        setPreview({ merchant, amount: quickParse(text).amount, category: 'other', confidence: 'low' });
      } finally { setPreviewing(false); }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [text]);

  const submit = async () => {
    if (!text.trim()) return;
    if (!isValidFormat(text)) {
      shake();
      showAlert({
        icon: '⚠️', title: 'Invalid Format',
        message: 'Include a ₱ amount and "at [merchant]"\n\nExample: "Spent ₱150 at Jollibee"',
        buttons: [{ text: 'Got it' }],
      });
      return;
    }
    setLoading(true);
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.94, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }),
    ]).start();
    try {
      const online = await isOnline();
      if (!online) {
        const queued = await addToQueue(text.trim());
        const { amount, merchant } = quickParse(text);
        const localTx = { id: queued.id, amount: amount || 0, merchant: merchant || 'Unknown', category: preview?.category || 'other', created_at: new Date().toISOString(), offline: true };
        await addToCache(localTx);
        setText(''); setPreview(null);
        setSuccessData({ ...localTx, offline: true }); setSuccessVisible(true);
      } else {
        const res = await postManualTransaction(text.trim());
        setText(''); setPreview(null);
        setSuccessData(res.data); setSuccessVisible(true);
      }
    } catch {
      showAlert({ icon: '❌', title: 'Error', message: 'Could not save. Check your connection.' });
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <CustomAlert {...alertProps} />

      {/* Success Modal */}
      <Modal transparent animationType="fade" visible={successVisible} onRequestClose={() => setSuccessVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>✅</Text>
            <Text style={styles.modalTitle}>{successData?.offline ? 'Saved Offline!' : 'Transaction Saved!'}</Text>
            {successData && (
              <View style={[styles.savedPreview, { borderColor: (CAT_COLORS[successData.category] || '#888') + '40' }]}>
                <View style={[styles.savedIconWrap, { backgroundColor: CAT_BG[successData.category] || '#F5F5F5' }]}>
                  <Text style={styles.savedIcon}>{CAT_ICONS[successData.category] || '📦'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedMerchant}>{successData.merchant}</Text>
                  <Text style={[styles.savedCat, { color: CAT_COLORS[successData.category] || '#888' }]}>{successData.category}</Text>
                </View>
                <Text style={styles.savedAmount}>₱{parseFloat(successData.amount).toLocaleString()}</Text>
              </View>
            )}
            <Text style={styles.modalMsg}>Your expense has been recorded.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnSec} onPress={() => setSuccessVisible(false)}>
                <Text style={styles.modalBtnSecText}>Add Another</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPri} onPress={() => { setSuccessVisible(false); navigation.navigate('Dashboard'); }}>
                <Text style={styles.modalBtnPriText}>Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: entranceOpacity, transform: [{ translateY: entranceY }] }}>
          <Text style={styles.heading}>Add Transaction</Text>
          <Text style={styles.sub}>Describe your expense in plain language</Text>
        </Animated.View>

        {/* Input card */}
        <Animated.View style={[styles.inputCard, { transform: [{ translateX: shakeAnim }] }]}>
          <TextInput
            style={styles.input}
            placeholder='"Spent ₱150 at Jollibee"'
            placeholderTextColor="#AAAAAA"
            value={text} onChangeText={setText}
            multiline autoFocus returnKeyType="done"
          />

          {/* AI Preview */}
          {(preview || previewing) && (
            <Animated.View style={[styles.previewCard, { opacity: previewOpacity, transform: [{ translateY: previewY }] }]}>
              {previewing ? (
                <View style={styles.previewLoading}>
                  <ActivityIndicator size="small" color="#00897B" />
                  <Text style={styles.previewLoadingText}>Gasto is analyzing...</Text>
                </View>
              ) : (
                <View style={styles.previewRow}>
                  <View style={[styles.previewIconWrap, { backgroundColor: CAT_BG[preview.category] || '#F5F5F5' }]}>
                    <Text style={styles.previewIcon}>{CAT_ICONS[preview.category] || '📦'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewMerchant}>{preview.merchant}</Text>
                    <View style={styles.previewMeta}>
                      <View style={[styles.previewBadge, { backgroundColor: (CAT_COLORS[preview.category] || '#888') + '20' }]}>
                        <Text style={[styles.previewBadgeText, { color: CAT_COLORS[preview.category] || '#888' }]}>{preview.category}</Text>
                      </View>
                      <Text style={[styles.previewConf,
                        preview.confidence === 'high'   && { color: '#00897B' },
                        preview.confidence === 'medium' && { color: '#FF8F00' },
                        preview.confidence === 'low'    && { color: '#BDBDBD' },
                      ]}>● {preview.confidence}</Text>
                    </View>
                  </View>
                  {preview.amount && <Text style={styles.previewAmt}>₱{preview.amount.toLocaleString()}</Text>}
                </View>
              )}
            </Animated.View>
          )}

          {/* Format hint */}
          {text.trim().length > 5 && !isValidFormat(text) && (
            <View style={styles.formatHint}>
              <Text style={styles.formatHintText}>⚠️ Include ₱ amount and "at [place]" — e.g. "Spent ₱150 at Jollibee"</Text>
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[styles.submitBtn, !text.trim() && styles.submitBtnDisabled]}
              onPress={submit} disabled={loading || !text.trim()}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Save Transaction</Text>}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Examples */}
        <Text style={styles.examplesLabel}>EXAMPLES — tap to use</Text>
        {EXAMPLES.map((ex, i) => (
          <TouchableOpacity key={i} style={styles.exampleItem} onPress={() => setText(ex)}>
            <Text style={styles.exampleText}>{ex}</Text>
            <Text style={styles.exampleArrow}>↗</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🤖 Gasto AI Categorization</Text>
          <Text style={styles.infoText}>
            As you type, Gasto automatically detects:{'\n'}
            • Amount (₱150){'\n'}
            • Merchant (Jollibee){'\n'}
            • Category (food, transport, bills, health…)
          </Text>
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  inner:     { padding: 20, paddingTop: 16 },

  heading: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  sub:     { fontSize: 13, color: '#9E9E9E', marginBottom: 20 },

  inputCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#EEEEEE', marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  input: { color: '#1A1A1A', fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },

  formatHint:     { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FFE082', marginBottom: 12 },
  formatHintText: { fontSize: 12, color: '#F57F17', lineHeight: 18 },

  previewCard: {
    backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#EEEEEE',
  },
  previewLoading:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewLoadingText: { fontSize: 13, color: '#9E9E9E' },
  previewRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewIconWrap:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  previewIcon:        { fontSize: 18 },
  previewMerchant:    { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  previewMeta:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewBadge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  previewBadgeText:   { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  previewConf:        { fontSize: 11, fontWeight: '500' },
  previewAmt:         { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },

  submitBtn:         { backgroundColor: '#00897B', borderRadius: 12, padding: 15, alignItems: 'center', shadowColor: '#00897B', shadowOpacity: 0.3, shadowRadius: 6, elevation: 2 },
  submitBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  submitBtnText:     { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  examplesLabel: { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 1, marginBottom: 10 },
  exampleItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#EEEEEE',
  },
  exampleText:  { fontSize: 13, color: '#555555', flex: 1 },
  exampleArrow: { fontSize: 14, color: '#00897B', marginLeft: 8 },

  infoBox: {
    backgroundColor: '#E0F2F1', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#B2DFDB', marginTop: 8,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#00897B', marginBottom: 8 },
  infoText:  { fontSize: 13, color: '#555555', lineHeight: 22 },

  // Success modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:    { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 28, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalIcon:    { fontSize: 48, marginBottom: 12 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 16, textAlign: 'center' },
  savedPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FA', borderRadius: 12, padding: 12, borderWidth: 1, width: '100%', marginBottom: 12 },
  savedIconWrap:{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  savedIcon:    { fontSize: 18 },
  savedMerchant:{ fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  savedCat:     { fontSize: 11, fontWeight: '600', textTransform: 'capitalize', marginTop: 2 },
  savedAmount:  { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  modalMsg:     { fontSize: 13, color: '#9E9E9E', textAlign: 'center', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtnSec:  { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnSecText: { fontSize: 14, fontWeight: '600', color: '#555555' },
  modalBtnPri:  { flex: 1, backgroundColor: '#00897B', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnPriText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
