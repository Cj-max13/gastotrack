import { registerRootComponent } from 'expo';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CustomAlert, { useCustomAlert } from './components/CustomAlert';
import BudgetScreen from './screens/BudgetScreen';
import DashboardScreen from './screens/DashboardScreen';
import TransactionsScreen from './screens/TransactionScreen';
import AddScreen from './screens/AddScreen';
import RegisterScreen from './screens/RegisterScreen';
import ChatScreen from './screens/ChatScreen';
import LoginScreen from './screens/LoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
    </View>
  );
}

// ── Main app tabs (shown when logged in) ──
function MainTabs({ user, onLogout }) {
  const { alertProps, showAlert } = useCustomAlert();

  return (
    <>
      <CustomAlert {...alertProps} />
      <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0F0F0F', shadowColor: 'transparent', borderBottomWidth: 0 },
        headerTintColor: '#F5F5F0',
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        tabBarStyle: {
          backgroundColor: '#0F0F0F',
          borderTopColor: '#222',
          borderTopWidth: 1,
          paddingBottom: 20,
          paddingTop: 10,
          height: 70,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
        tabBarActiveTintColor: '#C8F135',
        tabBarInactiveTintColor: '#5A5A54',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'GastoTrack',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
          headerRight: () => (
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
              style={{ marginRight: 16 }}
            >
              <Text style={{ fontSize: 22 }}>👤</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{
          title: 'Transactions',
          tabBarLabel: 'Expenses',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💸" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddScreen}
        options={{
          title: '➕ Transaction',
          tabBarLabel: 'Add',
          tabBarIcon: ({ focused }) => <TabIcon emoji="➕" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Budget"
        component={BudgetScreen}
        options={{
          title: '🎯 Budget',
          tabBarLabel: 'Budget',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: 'Gasto AI',
          tabBarLabel: 'AI Chat',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🤖" focused={focused} />,
        }}
      />
    </Tab.Navigator>
    </>
  );
}

// ── Auth stack (shown when logged out) ──
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
    <View style={{ flex: 1, backgroundColor: '#0F0F0F', justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ opacity: fade, transform: [{ scale: pulse }], alignItems: 'center' }}>
        <Text style={{ fontSize: 56, marginBottom: 12 }}>💸</Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#C8F135', letterSpacing: -1 }}>GastoTrack</Text>
        <Text style={{ fontSize: 12, color: '#5A5A54', marginTop: 4, marginBottom: 28 }}>Smart expense tracking</Text>
        <ActivityIndicator color="#C8F135" size="small" />
      </Animated.View>
    </View>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true); // checking stored token on launch

  // On app launch, check if a token is already saved
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        const token = await AsyncStorage.getItem('token');
        if (stored && token) setUser(JSON.parse(stored));
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  if (checking) {
    return <SplashScreen />;
  }

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
