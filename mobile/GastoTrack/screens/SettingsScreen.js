import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import { clearQueue, getCachedTransactions, getLastSyncTime } from '../Services/OfflineManager';

const VERSION = '1.0.0';

export default function SettingsScreen({ navigation, onLogout }) {
  const [user, setUser]               = useState(null);
  const [darkMode, setDarkMode]       = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync]       = useState(true);
  const [cacheSize, setCacheSize]     = useState(0);
  const [lastSync, setLastSync]       = useState(null);
  const { alertProps, showAlert }     = useCustomAlert();

  useEffect(() => {
    loadData();
  }, []);

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
      icon: '🗑️',
      title: 'Clear Cache?',
      message: 'This will remove locally cached transactions. They are still saved on the server.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearQueue();
            await AsyncStorage.removeItem('cached_transactions');
            await AsyncStorage.removeItem('last_sync_time');
            setCacheSize(0);
            setLastSync(null);
            showAlert({ icon: '✅', title: 'Cache Cleared', message: 'Local cache has been cleared.' });
          },
        },
      ],
    });
  };

  const handleSignOut = () => {
    showAlert({
      icon: '👤',
      title: 'Sign Out',
      message: `Signed in as ${user?.name || user?.email}.\nDo you want to sign out?`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onLogout },
      ],
    });
  };

  const toggleNotifications = async (val) => {
    setNotifications(val);
    await AsyncStorage.setItem('setting_notifications', String(val));
  };

  const toggleAutoSync = async (val) => {
    setAutoSync(val);
    await AsyncStorage.setItem('setting_autosync', String(val));
  };

  const formatDate = (iso) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Text style={styles.rowIcon}>{icon}</Text>
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
      <CustomAlert {...alertProps} />

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
      </View>

      {/* Preferences */}
      <Section title="PREFERENCES">
        <Row
          icon="🔔"
          label="Notifications"
          right={
            <Switch
              value={notifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#2A2A2A', true: '#C8F13560' }}
              thumbColor={notifications ? '#C8F135' : '#5A5A54'}
            />
          }
        />
        <Row
          icon="🔄"
          label="Auto-sync when online"
          right={
            <Switch
              value={autoSync}
              onValueChange={toggleAutoSync}
              trackColor={{ false: '#2A2A2A', true: '#C8F13560' }}
              thumbColor={autoSync ? '#C8F135' : '#5A5A54'}
            />
          }
          last
        />
      </Section>

      {/* Data */}
      <Section title="DATA">
        <Row
          icon="💾"
          label="Cached transactions"
          value={`${cacheSize} items`}
        />
        <Row
          icon="🕐"
          label="Last synced"
          value={formatDate(lastSync)}
        />
        <Row
          icon="🗑️"
          label="Clear local cache"
          onPress={handleClearCache}
          last
        />
      </Section>

      {/* About */}
      <Section title="ABOUT">
        <Row icon="📱" label="App version" value={VERSION} />
        <Row icon="🤖" label="AI model" value="Gemini 2.0 Flash" />
        <Row icon="🗄️" label="Database" value="PostgreSQL" />
        <Row
          icon="📋"
          label="Categories tracked"
          value="7"
          last
        />
      </Section>

      {/* Account */}
      <Section title="ACCOUNT">
        <Row
          icon="🚪"
          label="Sign Out"
          onPress={handleSignOut}
          danger
          last
        />
      </Section>

      <Text style={styles.footer}>GastoTrack v{VERSION} · Made with 💚</Text>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  inner: { padding: 16, paddingTop: 20 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#181818', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 24,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#C8F135',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#0F0F0F' },
  profileName: { fontSize: 16, fontWeight: '700', color: '#F5F5F0' },
  profileEmail: { fontSize: 13, color: '#5A5A54', marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', color: '#5A5A54',
    letterSpacing: 1.2, marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#181818', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A2A', overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 14, color: '#F5F5F0', fontWeight: '500' },
  rowLabelDanger: { color: '#FF6B6B' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, color: '#5A5A54' },
  rowChevron: { fontSize: 18, color: '#3A3A3A' },

  footer: {
    textAlign: 'center', fontSize: 12, color: '#3A3A3A', marginTop: 8,
  },
});
