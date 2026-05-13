import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from 'react-native';
import { register } from '../Services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

export default function RegisterScreen({ navigation }) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const { alertProps, showAlert } = useCustomAlert();

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      showAlert({ icon: '⚠️', title: 'Missing Fields', message: 'Please fill in all fields.' });
      return;
    }
    if (password.length < 6) {
      showAlert({ icon: '⚠️', title: 'Weak Password', message: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirm) {
      showAlert({ icon: '⚠️', title: 'Password Mismatch', message: 'Passwords do not match.' });
      return;
    }
    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      showAlert({
        icon: '🎉', title: 'Account Created!',
        message: `Welcome, ${name.trim()}!\n\nPlease sign in to continue.`,
        buttons: [{ text: 'Sign In Now', onPress: () => navigation.navigate('Login') }],
      });
    } catch (e) {
      showAlert({ icon: '❌', title: 'Registration Failed', message: e.response?.data?.error || 'Could not connect to server.' });
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
        <View style={styles.logoArea}>
          <View style={styles.logoIconWrap}>
            <Text style={styles.logoIcon}>💸</Text>
          </View>
          <Text style={styles.logoTitle}>GastoTrack</Text>
          <Text style={styles.logoSub}>Smart expense tracking</Text>
        </View>

        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.sub}>Start tracking your expenses today</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput
            style={styles.input} placeholder="Juan dela Cruz" placeholderTextColor="#AAAAAA"
            value={name} onChangeText={setName} autoCapitalize="words"
          />
        </View>

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
              style={[styles.input, { flex: 1 }]} placeholder="Min. 6 characters" placeholderTextColor="#AAAAAA"
              value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(v => !v)}>
              <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <TextInput
            style={[styles.input, confirm.length > 0 && confirm !== password && styles.inputError]}
            placeholder="Re-enter password" placeholderTextColor="#AAAAAA"
            value={confirm} onChangeText={setConfirm} secureTextEntry={!showPw} autoCapitalize="none"
          />
          {confirm.length > 0 && confirm !== password && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={submit} disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  inner:     { padding: 24, paddingTop: 48, flexGrow: 1 },

  logoArea:    { alignItems: 'center', marginBottom: 32 },
  logoIconWrap:{
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#00897B',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#00897B', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  logoIcon:  { fontSize: 30 },
  logoTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  logoSub:   { fontSize: 12, color: '#9E9E9E', marginTop: 3 },

  heading: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  sub:     { fontSize: 13, color: '#9E9E9E', marginBottom: 20 },

  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#1A1A1A',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  inputError: { borderColor: '#E53935' },
  errorText:  { fontSize: 11, color: '#E53935', marginTop: 4 },
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

  footer:     { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { fontSize: 14, color: '#9E9E9E' },
  footerLink: { fontSize: 14, color: '#00897B', fontWeight: '700' },
});
