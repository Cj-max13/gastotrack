import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../Services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

export default function LoginScreen({ navigation, onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { alertProps, showAlert } = useCustomAlert();

  // ── Entrance animations ──
  const logoAnim    = useRef(new Animated.Value(0)).current;
  const formAnim    = useRef(new Animated.Value(40)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(logoAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(formAnim,    { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(formOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const btnScale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

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
      onLogin(res.data.user);
    } catch (e) {
      const msg = e.response?.data?.error || 'Could not connect to server.';
      showAlert({ icon: '❌', title: 'Login Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <CustomAlert {...alertProps} />

      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.logoArea, { opacity: logoAnim, transform: [{ scale: logoScale }] }]}>
          <Text style={styles.logoIcon}>💸</Text>
          <Text style={styles.logoTitle}>GastoTrack</Text>
          <Text style={styles.logoSub}>Smart expense tracking</Text>
        </Animated.View>

        <Animated.View style={{ opacity: formOpacity, transform: [{ translateY: formAnim }] }}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to your account</Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input} placeholder="you@email.com" placeholderTextColor="#5A5A54"
                value={email} onChangeText={setEmail} keyboardType="email-address"
                autoCapitalize="none" autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]} placeholder="••••••••" placeholderTextColor="#5A5A54"
                  value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none"
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={submit} onPressIn={pressIn} onPressOut={pressOut} disabled={loading}
              >
                {loading ? <ActivityIndicator color="#0F0F0F" /> : <Text style={styles.btnText}>Sign In</Text>}
              </TouchableOpacity>
            </Animated.View>
          </View>

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
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  inner: { padding: 24, paddingTop: 60, flexGrow: 1 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoIcon: { fontSize: 52, marginBottom: 8 },
  logoTitle: { fontSize: 28, fontWeight: '800', color: '#C8F135', letterSpacing: -1 },
  logoSub: { fontSize: 13, color: '#5A5A54', marginTop: 4 },
  heading: { fontSize: 24, fontWeight: '700', color: '#F5F5F0', letterSpacing: -0.5 },
  sub: { fontSize: 13, color: '#9A9A92', marginTop: 4, marginBottom: 28 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 11, fontWeight: '600', color: '#5A5A54', letterSpacing: 1.2 },
  input: { backgroundColor: '#181818', borderRadius: 12, padding: 16, fontSize: 15, color: '#F5F5F0', borderWidth: 1, borderColor: '#2A2A2A' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { backgroundColor: '#181818', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2A2A2A' },
  eyeIcon: { fontSize: 16 },
  btn: { backgroundColor: '#C8F135', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#0F0F0F' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { fontSize: 14, color: '#5A5A54' },
  footerLink: { fontSize: 14, color: '#C8F135', fontWeight: '600' },
});
