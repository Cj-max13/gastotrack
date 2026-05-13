import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Animated, NativeModules, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../Services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

async function saveTokenNative(token) {
  try {
    if (Platform.OS === 'android' && NativeModules.SharedPrefs) {
      NativeModules.SharedPrefs.setString('auth_token', token);
    }
  } catch { /* not available in Expo Go */ }
}

export default function LoginScreen({ navigation, onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const { alertProps, showAlert } = useCustomAlert();

  const logoScale   = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formY       = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(formY,       { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert({ icon: '⚠️', title: 'Missing Fields', message: 'Please enter your email and password.' });
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
      await saveTokenNative(res.data.token);
      onLogin(res.data.user);
    } catch (e) {
      showAlert({ icon: '❌', title: 'Login Failed', message: e.response?.data?.error || 'Could not connect to server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <CustomAlert {...alertProps} />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <Animated.View style={[styles.logoArea, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoIconWrap}>
            <Text style={styles.logoIcon}>💸</Text>
          </View>
          <Text style={styles.logoTitle}>GastoTrack</Text>
          <Text style={styles.logoSub}>Smart expense tracking</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={{ opacity: formOpacity, transform: [{ translateY: formY }] }}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to your account</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input} placeholder="you@email.com" placeholderTextColor="#AAAAAA"
              value={email} onChangeText={setEmail} keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.pwRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]} placeholder="••••••••" placeholderTextColor="#AAAAAA"
                value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
                <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={submit} disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  inner:     { padding: 24, paddingTop: 60, flexGrow: 1 },

  logoArea:    { alignItems: 'center', marginBottom: 40 },
  logoIconWrap:{
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#00897B',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#00897B', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  logoIcon:  { fontSize: 36 },
  logoTitle: { fontSize: 26, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  logoSub:   { fontSize: 13, color: '#9E9E9E', marginTop: 4 },

  heading: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  sub:     { fontSize: 13, color: '#9E9E9E', marginBottom: 24 },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#1A1A1A',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  pwRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E0E0E0' },
  eyeIcon:{ fontSize: 16 },

  btn: {
    backgroundColor: '#00897B', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 8,
    shadowColor: '#00897B', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: '#9E9E9E' },
  footerLink: { fontSize: 14, color: '#00897B', fontWeight: '700' },
});
