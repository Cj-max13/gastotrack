import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Modal, Animated,
} from 'react-native';
import { postTransaction, previewCategorize } from '../Services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import { isOnline, addToQueue, addToCache } from '../services/OfflineManager';

const EXAMPLES = [
  'Spent ₱150 at Jollibee',
  'Paid ₱500 at Netflix',
  'Grabbed ride for ₱80 at Grab',
  'Bought groceries ₱320 at SM Supermarket',
  'Paid ₱200 at Shell',
  'Bought medicine ₱450 at Mercury Drug',
  'Paid ₱999 at Shopee',
];

const CAT_ICONS  = { food:'🍔', transport:'🚗', entertainment:'🎬', health:'💊', shopping:'🛍️', utilities:'💡', other:'📦' };
const CAT_COLORS = { food:'#FF6B6B', transport:'#4ECDC4', entertainment:'#FFE66D', health:'#A8E6CF', shopping:'#C3A6FF', utilities:'#FFB347', other:'#A8A8A0' };

// ── Format validation ────────────────────────────────────────────────────────
// Must contain a ₱ amount AND an "at <merchant>" phrase
function isValidFormat(text) {
  const hasAmount   = /₱\s?\d+/.test(text);
  const hasMerchant = /\bat\s+[A-Za-z]/i.test(text);
  return hasAmount && hasMerchant;
}

function quickParse(text) {
  const amountMatch   = text.match(/₱\s?(\d+(\.\d+)?)/);
  const merchantMatch = text.match(/at ([A-Za-z0-9\s&'.,-]+?)(?:\s*$|\s+for\b|\s+worth\b)/i)
                     || text.match(/at ([A-Za-z0-9\s&'.,-]+)/i);
  return {
    amount:   amountMatch   ? parseFloat(amountMatch[1])   : null,
    merchant: merchantMatch ? merchantMatch[1].trim()      : null,
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

  // ── Animations ──────────────────────────────────────────────────────────
  // Card shake on invalid input
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  // Preview card fade/slide in
  const previewOpacity   = useRef(new Animated.Value(0)).current;
  const previewTranslate = useRef(new Animated.Value(-8)).current;
  // Submit button pulse on success
  const btnScale = useRef(new Animated.Value(1)).current;
  // Entrance: heading + card slide up
  const entranceAnim = useRef(new Animated.Value(30)).current;
  const entranceOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceAnim,    { toValue: 0, duration: 450, useNativeDriver: true }),
      Animated.timing(entranceOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  4,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const pulseBtn = () => {
    Animated.sequence([
      Animated.spring(btnScale, { toValue: 0.94, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1.04, useNativeDriver: true }),
      Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }),
    ]).start();
  };

  // Animate preview card in/out
  useEffect(() => {
    if (preview || previewing) {
      previewOpacity.setValue(0);
      previewTranslate.setValue(-8);
      Animated.parallel([
        Animated.timing(previewOpacity,   { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(previewTranslate, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [preview, previewing]);

  // ── Debounced AI preview ─────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceRef.current);
    const { amount, merchant } = quickParse(text);
    if (!merchant || !text.trim()) { setPreview(null); return; }

    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await previewCategorize(merchant, text);
        setPreview({ merchant, amount, category: res.data.category, confidence: res.data.confidence });
      } catch {
        setPreview({ merchant, amount, category: 'other', confidence: 'low' });
      } finally {
        setPreviewing(false);
      }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [text]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!text.trim()) return;

    // Format validation
    if (!isValidFormat(text)) {
      shake();
      showAlert({
        icon: '⚠️',
        title: 'Invalid Format',
        message:
          'Please follow the example format:\n\n' +
          '"Spent ₱150 at Jollibee"\n' +
          '"Paid ₱500 at Netflix"\n' +
          '"Bought groceries ₱320 at SM"\n\n' +
          'Your text must include a ₱ amount and "at [merchant name]".',
        buttons: [{ text: 'Got it' }],
      });
      return;
    }

    setLoading(true);
    pulseBtn();
    try {
      const online = await isOnline();

      if (!online) {
        // ── OFFLINE: save to queue ──
        const queued = await addToQueue(text.trim());
        // Build a local transaction for immediate display
        const { amount, merchant } = quickParse(text);
        const localTx = {
          id: queued.id,
          amount: amount || 0,
          merchant: merchant || 'Unknown',
          category: preview?.category || 'other',
          raw_text: text.trim(),
          created_at: new Date().toISOString(),
          offline: true, // flag so UI can show pending badge
        };
        await addToCache(localTx);
        setText('');
        setPreview(null);
        setSuccessData({ ...localTx, offline: true });
        setSuccessVisible(true);
      } else {
        // ── ONLINE: save to server ──
        const res = await postTransaction(text.trim());
        setText('');
        setPreview(null);
        setSuccessData(res.data);
        setSuccessVisible(true);
      }
    } catch (e) {
      showAlert({ icon: '❌', title: 'Connection Error', message: 'Could not connect to server.\nMake sure your backend is running.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <CustomAlert {...alertProps} />

      {/* ── Success Modal ── */}
      <Modal transparent animationType="fade" visible={successVisible} onRequestClose={() => setSuccessVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { transform: [{ scale: btnScale }] }]}>
            <Text style={styles.modalIcon}>✅</Text>
            <Text style={styles.modalTitle}>
              {successData?.offline ? 'Saved Offline!' : 'Transaction Saved!'}
            </Text>
            {successData?.offline && (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineBadgeText}>📵 Will sync when you're back online</Text>
              </View>
            )}
            {successData && (
              <View style={[styles.savedPreview, { borderColor: (CAT_COLORS[successData.category] || '#888') + '40' }]}>
                <Text style={styles.savedIcon}>{CAT_ICONS[successData.category] || '📦'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedMerchant}>{successData.merchant}</Text>
                  <View style={[styles.savedBadge, { backgroundColor: (CAT_COLORS[successData.category] || '#888') + '25' }]}>
                    <Text style={[styles.savedBadgeText, { color: CAT_COLORS[successData.category] || '#888' }]}>
                      {successData.category}
                    </Text>
                  </View>
                </View>
                <Text style={styles.savedAmount}>₱{parseFloat(successData.amount).toLocaleString()}</Text>
              </View>
            )}
            <Text style={styles.modalMessage}>Your expense has been recorded successfully.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setSuccessVisible(false)}>
                <Text style={styles.modalBtnSecondaryText}>Add Another</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => { setSuccessVisible(false); navigation.navigate('Dashboard'); }}>
                <Text style={styles.modalBtnPrimaryText}>View Dashboard</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* Animated entrance */}
        <Animated.View style={{ opacity: entranceOpacity, transform: [{ translateY: entranceAnim }] }}>
          <Text style={styles.heading}>Add Transaction</Text>
          <Text style={styles.sub}>Type a natural description of your expense</Text>
        </Animated.View>

        {/* Shakeable input card */}
        <Animated.View style={[styles.inputCard, { transform: [{ translateX: shakeAnim }] }]}>
          <TextInput
            style={styles.input}
            placeholder='e.g. "Spent ₱150 at Jollibee"'
            placeholderTextColor="#5A5A54"
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            returnKeyType="done"
          />

          {/* Live AI Preview — animated */}
          {(preview || previewing) && (
            <Animated.View style={[
              styles.previewCard,
              preview && { borderColor: (CAT_COLORS[preview.category] || '#888') + '50' },
              { opacity: previewOpacity, transform: [{ translateY: previewTranslate }] },
            ]}>
              {previewing ? (
                <View style={styles.previewLoading}>
                  <ActivityIndicator size="small" color="#C8F135" />
                  <Text style={styles.previewLoadingText}>AI is analyzing...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewCatIcon}>{CAT_ICONS[preview.category] || '📦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewMerchant}>{preview.merchant}</Text>
                      <View style={styles.previewBadgeRow}>
                        <View style={[styles.previewBadge, { backgroundColor: (CAT_COLORS[preview.category] || '#888') + '25' }]}>
                          <Text style={[styles.previewBadgeText, { color: CAT_COLORS[preview.category] || '#888' }]}>
                            {preview.category}
                          </Text>
                        </View>
                        <Text style={[
                          styles.previewConfidence,
                          preview.confidence === 'high'   && { color: '#C8F135' },
                          preview.confidence === 'medium' && { color: '#FFE66D' },
                          preview.confidence === 'low'    && { color: '#5A5A54' },
                        ]}>
                          {preview.confidence === 'high' ? '● High' : preview.confidence === 'medium' ? '● Medium' : '● Low'}
                        </Text>
                      </View>
                    </View>
                    {preview.amount && <Text style={styles.previewAmount}>₱{preview.amount.toLocaleString()}</Text>}
                  </View>
                  <Text style={styles.previewHint}>🤖 AI detected — saved automatically on submit</Text>
                </>
              )}
            </Animated.View>
          )}

          {/* Format hint when text exists but format is wrong */}
          {text.trim().length > 5 && !isValidFormat(text) && (
            <Animated.View style={[styles.formatHint, { opacity: entranceOpacity }]}>
              <Text style={styles.formatHintText}>
                ⚠️ Include a ₱ amount and "at [place]" — e.g. "Spent ₱150 at Jollibee"
              </Text>
            </Animated.View>
          )}

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[styles.submitBtn, !text.trim() && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={loading || !text.trim()}
            >
              {loading
                ? <ActivityIndicator color="#0F0F0F" />
                : <Text style={styles.submitBtnText}>Save Transaction</Text>
              }
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        <Text style={styles.examplesLabel}>EXAMPLES — tap to use</Text>
        {EXAMPLES.map((ex, i) => (
          <Animated.View
            key={i}
            style={{
              opacity: entranceOpacity,
              transform: [{ translateY: Animated.multiply(entranceAnim, new Animated.Value((i + 1) * 0.3)) }],
            }}
          >
            <TouchableOpacity style={styles.exampleItem} onPress={() => setText(ex)}>
              <Text style={styles.exampleText}>{ex}</Text>
              <Text style={styles.exampleArrow}>↗</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🤖 AI-Powered Categorization</Text>
          <Text style={styles.infoText}>
            As you type, the AI automatically detects:{'\n'}
            • Amount (₱150){'\n'}
            • Merchant (Jollibee){'\n'}
            • Category (food, transport, entertainment,{'\n'}
            {'  '}health, shopping, utilities)
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  inner: { padding: 20, paddingTop: 24 },

  heading: { fontSize: 26, fontWeight: '700', color: '#F5F5F0', letterSpacing: -0.5 },
  sub: { fontSize: 13, color: '#9A9A92', marginTop: 6, marginBottom: 24 },

  inputCard: {
    backgroundColor: '#181818', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 28,
  },
  input: { color: '#F5F5F0', fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 14 },

  formatHint: {
    backgroundColor: '#2A1A00', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FFB34740', marginBottom: 12,
  },
  formatHintText: { fontSize: 12, color: '#FFB347', lineHeight: 18 },

  previewCard: {
    backgroundColor: '#0F0F0F', borderRadius: 12, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: '#2A2A2A',
  },
  previewLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  previewLoadingText: { fontSize: 13, color: '#9A9A92' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewCatIcon: { fontSize: 28 },
  previewMerchant: { fontSize: 14, fontWeight: '600', color: '#F5F5F0', marginBottom: 4 },
  previewBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  previewBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  previewConfidence: { fontSize: 11, fontWeight: '500' },
  previewAmount: { fontSize: 16, fontWeight: '700', color: '#F5F5F0' },
  previewHint: { fontSize: 11, color: '#5A5A54', marginTop: 8 },

  submitBtn: { backgroundColor: '#C8F135', borderRadius: 12, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#0F0F0F' },

  examplesLabel: { fontSize: 11, fontWeight: '600', color: '#5A5A54', letterSpacing: 1.2, marginBottom: 10 },
  exampleItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#181818', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#222',
  },
  exampleText: { fontSize: 13, color: '#9A9A92', flex: 1 },
  exampleArrow: { fontSize: 14, color: '#C8F135', marginLeft: 8 },

  infoBox: {
    backgroundColor: '#161f0a', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#C8F13530', marginTop: 20,
  },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#C8F135', marginBottom: 10 },
  infoText: { fontSize: 13, color: '#9A9A92', lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#181818', borderRadius: 20, padding: 28, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center' },
  modalIcon: { fontSize: 48, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#F5F5F0', marginBottom: 12, textAlign: 'center' },
  savedPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F0F0F', borderRadius: 12, padding: 12, borderWidth: 1, width: '100%', marginBottom: 12 },
  savedIcon: { fontSize: 28 },
  savedMerchant: { fontSize: 14, fontWeight: '600', color: '#F5F5F0', marginBottom: 4 },
  savedBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  savedBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  savedAmount: { fontSize: 16, fontWeight: '700', color: '#F5F5F0' },
  modalMessage: { fontSize: 14, color: '#9A9A92', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtnSecondary: { flex: 1, backgroundColor: '#222', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  modalBtnSecondaryText: { fontSize: 14, fontWeight: '600', color: '#F5F5F0' },
  modalBtnPrimary: { flex: 1, backgroundColor: '#C8F135', borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#0F0F0F' },
  offlineBadge: {
    backgroundColor: '#1A0A00', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FF6B6B30', marginBottom: 12, width: '100%',
  },
  offlineBadgeText: { fontSize: 12, color: '#FFB347', textAlign: 'center' },
});
