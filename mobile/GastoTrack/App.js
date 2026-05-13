import { registerRootComponent } from 'expo';
import { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Text, View, ActivityIndicator, TouchableOpacity,
  Animated, StyleSheet, Dimensions, Platform, NativeModules,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CustomAlert, { useCustomAlert } from './components/CustomAlert';
import OfflineBanner from './components/OfflineBanner';
import { subscribeToNetwork, syncQueue } from './Services/OfflineManager';
import { postTransaction } from './Services/api';

import DashboardScreen    from './screens/DashboardScreen';
import AnalyticsScreen   from './screens/AnalyticsScreen';
import TransactionsScreen from './screens/TransactionScreen';
import AddScreen         from './screens/AddScreen';
import BudgetScreen      from './screens/BudgetScreen';
import ChatScreen        from './screens/ChatScreen';
import LoginScreen       from './screens/LoginScreen';
import RegisterScreen    from './screens/RegisterScreen';
import SettingsScreen    from './screens/SettingsScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const { width } = Dimensions.get('window');

// ── Colors ────────────────────────────────────────────────────────────────────
const GREEN  = '#C8F135';
const DARK   = '#0F0F0F';
const PILL   = '#1C1C1C';   // pill background
const ACTIVE = '#C8F135';   // active label
const INACTIVE = '#6B6B6B'; // inactive label

// ── Tab bar config — matches mockup: Dashboard, Analytics, AI Assistant, Budget, History
const TAB_CONFIG = [
  { name: 'Dashboard',  label: 'Dashboard',    icon: '⊞' },
  { name: 'Analytics',  label: 'Analytics',    icon: '↗' },
  { name: 'Chat',       label: 'Gasto', icon: '🤖' },
  { name: 'Budget',     label: 'Budget',       icon: '▣' },
  { name: 'Transactions', label: 'History',    icon: '🕐' },
];

// Screens that should hide the tab bar entirely
const HIDDEN_TAB_SCREENS = [];

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[navStyles.wrapper, { paddingBottom: insets.bottom || 8 }]}>
      {TAB_CONFIG.map((tab, index) => {
        const route     = state.routes.find(r => r.name === tab.name);
        if (!route) return null;
        const isFocused = state.routes[state.index]?.name === tab.name;
        const isAI      = tab.name === 'Chat';

        return (
          <TouchableOpacity
            key={tab.name}
            style={navStyles.tabItem}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
          >
            {isAI ? (
              <View style={[navStyles.aiFab, isFocused && navStyles.aiFabActive]}>
                <Text style={navStyles.aiFabIcon}>🤖</Text>
              </View>
            ) : (
              <View style={[navStyles.iconWrap, isFocused && navStyles.iconWrapActive]}>
                <Text style={[navStyles.tabIcon, isFocused && navStyles.tabIconActive]}>
                  {tab.icon}
                </Text>
              </View>
            )}
            <Text style={[navStyles.tabLabel, isFocused && navStyles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const navStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#E0F2F1',
  },
  tabIcon:       { fontSize: 18, color: '#9E9E9E' },
  tabIconActive: { color: '#00897B' },
  tabLabel:      { fontSize: 10, color: '#9E9E9E', fontWeight: '500', textAlign: 'center' },
  tabLabelActive:{ color: '#00897B', fontWeight: '700' },

  // AI Assistant center button
  aiFab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
    marginTop: -8,
  },
  aiFabActive: { backgroundColor: '#00897B' },
  aiFabIcon:   { fontSize: 20 },
});

function MainTabs({ user, onLogout }) {
  const { alertProps, showAlert } = useCustomAlert();

  return (
    <>
      <CustomAlert {...alertProps} />
      <OfflineBanner />
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#FFFFFF',
            shadowColor: 'transparent',
            borderBottomWidth: 1,
            borderBottomColor: '#EEEEEE',
            elevation: 0,
          },
          headerTintColor: '#1A1A1A',
          headerTitleStyle: { fontWeight: '700', fontSize: 18, color: '#1A1A1A' },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={({ navigation }) => ({
            title: 'GastoTrack',
            headerLeft: () => (
              <View style={{ marginLeft: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18 }}>👤</Text>
              </View>
            ),
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 12 }}>
                <TouchableOpacity onPress={() => navigation.navigate('Add')}>
                  <Text style={{ fontSize: 22 }}>➕</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => showAlert({
                  icon: '👤', title: 'Sign Out',
                  message: `Signed in as ${user?.name || user?.email}.\nDo you want to sign out?`,
                  buttons: [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: onLogout },
                  ],
                })}>
                  <Text style={{ fontSize: 22 }}>�</Text>
                </TouchableOpacity>
              </View>
            ),
          })}
        />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ title: 'Analytics' }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={({ navigation }) => ({
            title: 'Gasto',
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ marginLeft: 16 }}
              >
                <Text style={{ fontSize: 20, color: '#1A1A1A' }}>←</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Tab.Screen
          name="Budget"
          component={BudgetScreen}
          options={{ title: 'Budget' }}
        />
        <Tab.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ title: 'History' }}
        />
        {/* Hidden screens — accessible via navigation but not in tab bar */}
        <Tab.Screen
          name="Add"
          component={AddScreen}
          options={{ title: 'Add Transaction', tabBarButton: () => null }}
        />
        <Tab.Screen
          name="Settings"
          options={{ title: 'Settings', tabBarButton: () => null }}
        >
          {(props) => <SettingsScreen {...props} onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </>
  );
}

// ── Auth stack ────────────────────────────────────────────────────────────────
function AuthStack({ onLogin }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onLogin={onLogin} />}
      </Stack.Screen>
      <Stack.Screen name="Register">
        {(props) => <RegisterScreen {...props} onLogin={onLogin} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// ── Splash screen ─────────────────────────────────────────────────────────────
function SplashScreen() {
  const pulse = useRef(new Animated.Value(1)).current;
  const fade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: DARK, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ opacity: fade, transform: [{ scale: pulse }], alignItems: 'center' }}>
        <Text style={{ fontSize: 56, marginBottom: 12 }}>💸</Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: GREEN, letterSpacing: -1 }}>GastoTrack</Text>
        <Text style={{ fontSize: 12, color: '#5A5A54', marginTop: 4, marginBottom: 28 }}>Smart expense tracking</Text>
        <ActivityIndicator color={GREEN} size="small" />
      </Animated.View>
    </View>
  );
}

// ── Root app ──────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser]       = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        const token  = await AsyncStorage.getItem('token');
        if (stored && token) setUser(JSON.parse(stored));
      } catch { /* ignore */ }
      finally { setChecking(false); }
    })();
  }, []);

  const handleLogin  = (userData) => setUser(userData);
  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    try {
      if (Platform.OS === 'android' && NativeModules.SharedPrefs) {
        NativeModules.SharedPrefs.remove('auth_token');
      }
    } catch { /* ignore in Expo Go */ }
    setUser(null);
  };

  // Auto-sync offline queue when back online
  useEffect(() => {
    const unsub = subscribeToNetwork(
      async () => {
        try {
          const { synced } = await syncQueue(postTransaction);
          if (synced > 0) console.log(`Synced ${synced} offline transaction(s)`);
        } catch { /* silent */ }
      },
      () => {}
    );
    return unsub;
  }, []);

  if (checking) return <SplashScreen />;

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      {user
        ? <MainTabs user={user} onLogout={handleLogout} />
        : <AuthStack onLogin={handleLogin} />
      }
    </NavigationContainer>
  );
}

registerRootComponent(App);
