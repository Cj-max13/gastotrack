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

import DashboardScreen  from './screens/DashboardScreen';
import TransactionsScreen from './screens/TransactionScreen';
import AddScreen        from './screens/AddScreen';
import BudgetScreen     from './screens/BudgetScreen';
import ChatScreen       from './screens/ChatScreen';
import LoginScreen      from './screens/LoginScreen';
import RegisterScreen   from './screens/RegisterScreen';
import SettingsScreen   from './screens/SettingsScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const { width } = Dimensions.get('window');

// ── Colors ────────────────────────────────────────────────────────────────────
const GREEN  = '#C8F135';
const DARK   = '#0F0F0F';
const PILL   = '#1C1C1C';   // pill background
const ACTIVE = '#C8F135';   // active label
const INACTIVE = '#6B6B6B'; // inactive label

// ── Custom Tab Bar ────────────────────────────────────────────────────────────
// Chat is NOT in the pill — accessed via AI button in Dashboard header
// Settings replaces the old text-only Budget slot
const TAB_CONFIG = [
  { name: 'Dashboard',    icon: '📊' },
  { name: 'Transactions', icon: '💸' },
  { name: 'Add',          icon: null },   // FAB
  { name: 'Budget',       icon: '🎯' },
  { name: 'Settings',     icon: '⚙️' },
];

// Screens that should hide the tab bar entirely
const HIDDEN_TAB_SCREENS = ['Chat'];

function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  // Hide the tab bar entirely on Chat screen
  const currentRoute = state.routes[state.index]?.name;
  if (HIDDEN_TAB_SCREENS.includes(currentRoute)) return null;

  const visibleRoutes = state.routes.filter(r =>
    TAB_CONFIG.some(t => t.name === r.name)
  );

  return (
    <View style={[navStyles.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={navStyles.pill}>
        {visibleRoutes.map((route) => {
          const tabCfg  = TAB_CONFIG.find(t => t.name === route.name);
          const isFocused = state.routes[state.index]?.name === route.name;

          // Center FAB (Add)
          if (route.name === 'Add') {
            return (
              <TouchableOpacity
                key={route.name}
                style={navStyles.fabWrap}
                onPress={() => navigation.navigate(route.name)}
                activeOpacity={0.85}
              >
                <View style={[navStyles.fab, isFocused && navStyles.fabActive]}>
                  <Text style={navStyles.fabIcon}>+</Text>
                </View>
              </TouchableOpacity>
            );
          }

          // Regular icon tab
          return (
            <TouchableOpacity
              key={route.name}
              style={navStyles.tabItem}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.7}
            >
              <Text style={[navStyles.tabIcon, isFocused && navStyles.tabIconActive]}>
                {tabCfg?.icon}
              </Text>
              {isFocused && <View style={navStyles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const navStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PILL,
    borderRadius: 40,
    height: 60,
    width: '100%',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },

  // Regular tab
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: GREEN,
    marginTop: 3,
  },

  // Center FAB (Add button)
  fabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: GREEN,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabActive: {
    backgroundColor: '#B8E120',
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: DARK,
    lineHeight: 32,
  },
});

function MainTabs({ user, onLogout }) {
  const { alertProps, showAlert } = useCustomAlert();

  return (
    <>
      <CustomAlert {...alertProps} />
      <OfflineBanner />
      <Tab.Navigator
        tabBar={(props) => (
          <CustomTabBar {...props} />
        )}
        screenOptions={{
          headerStyle: {
            backgroundColor: DARK,
            shadowColor: 'transparent',
            borderBottomWidth: 0,
            elevation: 0,
          },
          headerTintColor: '#F5F5F0',
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={({ navigation }) => ({
            title: 'GastoTrack',
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 8 }}>
                {/* AI Chat button */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('Chat')}
                  style={{
                    backgroundColor: GREEN, borderRadius: 20,
                    paddingHorizontal: 12, paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: DARK, letterSpacing: 0.5 }}>🤖 AI</Text>
                </TouchableOpacity>
                {/* Profile / sign out */}
                <TouchableOpacity
                  onPress={() => showAlert({
                    icon: '👤',
                    title: 'Sign Out',
                    message: `Signed in as ${user?.name || user?.email}.\nDo you want to sign out?`,
                    buttons: [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
                    ],
                  })}
                >
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </TouchableOpacity>
              </View>
            ),
          })}
        />
        <Tab.Screen
          name="Transactions"
          component={TransactionsScreen}
          options={{ title: 'Expenses' }}
        />
        <Tab.Screen
          name="Add"
          component={AddScreen}
          options={{ title: 'Add Transaction' }}
        />
        <Tab.Screen
          name="Budget"
          component={BudgetScreen}
          options={{ title: 'Budget' }}
        />
        {/* Chat is NOT in the pill nav — accessed via AI button in header */}
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={({ navigation }) => ({
            title: 'Gasto AI',
            tabBarButton: () => null,   // hide from tab bar completely
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Dashboard')}
                style={{ marginLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text style={{ fontSize: 20, color: '#F5F5F0' }}>←</Text>
                <Text style={{ fontSize: 14, color: '#F5F5F0', fontWeight: '500' }}>Back</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Tab.Screen
          name="Settings"
          component={(props) => <SettingsScreen {...props} onLogout={onLogout} />}
          options={{ title: 'Settings' }}
        />
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
