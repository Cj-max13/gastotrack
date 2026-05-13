import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, TextInput, Modal,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Linking, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import { clearQueue, getCachedTransactions, getLastSyncTime } from '../Services/OfflineManager';
import { deleteAccount } from '../Services/api';

const VERSION = '1.0.0';
const TEAL = '#00897B';

export default function SettingsScreen({ navigation, onLogout }) {
  const [user, setUser]               = useState(null);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync]       = useState(true);
  const [cacheSize, setCacheSize]     = useState(0);
  const [lastSync, setLastSync]       = useState(null);
  const { alertProps, showAlert }     = useCustomAlert();

  const [deleteVisible, setDeleteVisible]   = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading]   = useState(false);
  const [deleteError, setDeleteError]       = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const stored = await AsyncStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    const cached = await getCachedTransactions();
    setCacheSize(cached.length);
    const sync = await getLastSyncTime();
    setLastSync(sync);
    const notif = await AsyncStorage.getItem('setting_notifications');
    if (notif !== null) setNotifications(notif === 'true');
    const sync2 = await AsyncStorage.getItem('setting_autosync');
    if (sync2 !== null) setAutoSync(sync2 === 'true');
  };

  const handleClearCache = () => {
    showAlert({
      icon: '🗑️', title: 'Clear Cache?',
      message: 'This will remove locally cached transactions. They are still saved on the server.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => {
          await clearQueue();
          await AsyncStorage.removeItem('cached_transactions');
          await AsyncStorage.removeItem('last_sync_time');
          setCacheSize(0); setLastSync(null);
          showAlert({ icon: '✅', title: 'Cache Cleared', message: 'Local cache has been cleared.' });
        }},
      ],
    });
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword.trim()) { setDeleteError('Please enter your password.'); return; }
    setDeleteLoading(true); setDeleteError('');
    try {
      await deleteAccount(deletePassword);
      setDeleteVisible(false);
      await AsyncStorage.multiRemove(['token','user','cached_transactions','last_sync_time','offline_queue','budgets']);
      onLogout();
    } catch (e) {
      setDeleteError(e.response?.data?.error || 'Failed. Check your password.');
    } finally { setDeleteLoading(false); }
  };

  const formatDate = (iso) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const Section = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );

  const Row = ({ icon, label, value, onPress, right, danger, last }) => (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={styles.rowIconWrap}>
        <Text style={styles.rowIcon}>{icon}</Text>
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {right || null}
        {onPress && !right ? <Text style={styles.rowChevron}>›</Text> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <CustomAlert {...alertProps} />

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name ? user.name.charAt(0).toUpperCase() : '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
        <TouchableOpacity style={styles.editProfileBtn} onPress={() => showAlert({ icon: '👤', title: 'Profile', message: `Signed in as ${user?.name}` })}>
          <Text style={styles.editProfileText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <Section title="PREFERENCES">
        <Row icon="🔔" label="Notifications" right={
          <Switch value={notifications} onValueChange={async v => { setNotifications(v); await AsyncStorage.setItem('setting_notifications', String(v)); }}
            trackColor={{ false: '#E0E0E0', true: TEAL + '60' }} thumbColor={notifications ? TEAL : '#BDBDBD'} />
        } />
        <Row icon="🔄" label="Auto-sync when online" right={
          <Switch value={autoSync} onValueChange={async v => { setAutoSync(v); await AsyncStorage.setItem('setting_autosync', String(v)); }}
            trackColor={{ false: '#E0E0E0', true: TEAL + '60' }} thumbColor={autoSync ? TEAL : '#BDBDBD'} />
        } last />
      </Section>

      <Section title="DATA">
        <Row icon="💾" label="Cached transactions" value={`${cacheSize} items`} />
        <Row icon="🕐" label="Last synced" value={formatDate(lastSync)} />
        <Row icon="🗑️" label="Clear local cache" onPress={handleClearCache} last />
      </Section>

      <Section title="AUTO-CAPTURE">
        <View style={styles.notifCard}>
          <Text style={styles.notifTitle}>📲 Notification Access</Text>
          <Text style={styles.notifSub}>Required to auto-capture GCash, Maya, and bank transactions without manual entry.</Text>
          <View style={styles.notifSteps}>
            {['Tap "Open Settings" below','Find GastoTrack in the list','Toggle it ON','Done! 🎉'].map((s, i) => (
              <View key={i} style={styles.notifStep}>
                <View style={styles.notifNum}><Text style={styles.notifNumText}>{i+1}</Text></View>
                <Text style={styles.notifStepText}>{s}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.notifApps}>GCash · Maya · BDO · BPI · Metrobank · UnionBank</Text>
          <TouchableOpacity style={styles.notifBtn} onPress={() => Linking.openSettings().catch(() => {})}>
            <Text style={styles.notifBtnText}>⚙️ Open Notification Settings</Text>
          </TouchableOpacity>
        </View>
      </Section>

      <Section title="ABOUT">
        <Row icon="📱" label="App version" value={VERSION} />
        <Row icon="🤖" label="AI model" value="Gemini 2.0 Flash" />
        <Row icon="🗄️" label="Database" value="PostgreSQL" last />
      </Section>

      <Section title="ACCOUNT">
        <Row icon="🚪" label="Sign Out" onPress={() => showAlert({
          icon: '👤', title: 'Sign Out',
          message: `Signed in as ${user?.name || user?.email}.\nDo you want to sign out?`,
          buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: onLogout }],
        })} danger />
        <Row icon="🗑️" label="Delete Account" onPress={() => { setDeletePassword(''); setDeleteError(''); setDeleteVisible(true); }} danger last />
      </Section>

      <Text style={styles.footer}>GastoTrack v{VERSION} · Made with 💚</Text>
      <View style={{ height: 100 }} />

      <Modal visible={deleteVisible} transparent animationType="slide" onRequestClose={() => setDeleteVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalWarning}>⚠️ This is permanent. All your data will be deleted and cannot be recovered.</Text>
            <Text style={styles.fieldLabel}>CONFIRM YOUR PASSWORD</Text>
            <TextInput
              style={styles.modalInput} value={deletePassword} onChangeText={setDeletePassword}
              placeholder="Enter your password" placeholderTextColor="#AAAAAA" secureTextEntry autoCapitalize="none"
            />
            {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteVisible(false)} disabled={deleteLoading}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={confirmDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.deleteBtnText}>Delete Forever</Text>}
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
  inner:     { padding: 16, paddingTop: 16 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#EEEEEE', marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#00897B', justifyContent: 'center', alignItems: 'center',
  },
  avatarText:    { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  profileName:   { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  profileEmail:  { fontSize: 12, color: '#9E9E9E', marginTop: 2 },
  editProfileBtn:{ backgroundColor: '#E0F2F1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  editProfileText:{ fontSize: 12, color: '#00897B', fontWeight: '600' },

  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
  sectionCard:  { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EEEEEE', overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  rowLast:        { borderBottomWidth: 0 },
  rowIconWrap:    { width: 28, alignItems: 'center' },
  rowIcon:        { fontSize: 18 },
  rowLabel:       { flex: 1, fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
  rowLabelDanger: { color: '#E53935' },
  rowRight:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue:       { fontSize: 13, color: '#9E9E9E' },
  rowChevron:     { fontSize: 18, color: '#BDBDBD' },

  // Notification card
  notifCard:     { padding: 16 },
  notifTitle:    { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  notifSub:      { fontSize: 12, color: '#9E9E9E', lineHeight: 18, marginBottom: 14 },
  notifSteps:    { gap: 8, marginBottom: 12 },
  notifStep:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifNum:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#00897B', justifyContent: 'center', alignItems: 'center' },
  notifNumText:  { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  notifStepText: { fontSize: 13, color: '#555555', flex: 1 },
  notifApps:     { fontSize: 11, color: '#BDBDBD', marginBottom: 14 },
  notifBtn:      { backgroundColor: '#00897B', borderRadius: 12, padding: 13, alignItems: 'center' },
  notifBtnText:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  footer: { textAlign: 'center', fontSize: 12, color: '#BDBDBD', marginTop: 8 },

  // Delete modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle:  { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#E53935', marginBottom: 12 },
  modalWarning: { fontSize: 13, color: '#555555', lineHeight: 20, backgroundColor: '#FFF3F3', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FFCDD2', marginBottom: 20 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 1, marginBottom: 6 },
  modalInput:   { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, color: '#1A1A1A', fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#EEEEEE' },
  deleteError:  { color: '#E53935', fontSize: 12, marginBottom: 12, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn:    { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16, alignItems: 'center' },
  cancelBtnText:{ color: '#666666', fontWeight: '600', fontSize: 15 },
  deleteBtn:    { flex: 1, backgroundColor: '#E53935', borderRadius: 14, padding: 16, alignItems: 'center' },
  deleteBtnText:{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
