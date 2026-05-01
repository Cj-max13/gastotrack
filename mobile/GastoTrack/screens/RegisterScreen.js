import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { register } from '../Services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

export default function RegisterScreen({ navigation }) {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
        icon: '🎉',
        title: 'Account Created!',
        message: `Welcome, ${name.trim()}!\n\nYour account has been created successfully. Please sign in to continue.`,
        buttons: [{ text: 'Sign In Now', onPress: () => navigation.navigate('Login') }],
      });
    } catch (e) {
      const msg = e.response?.data?.error || 'Could not connect to server.';
      showAlert({ icon: '❌', title: 'Registration Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <CustomAlert {...alertProps} />

      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Text style={styles.logoIcon}>💸</Text>
          <Text style={styles.logoTitle}>GastoTrack</Text>
          <Text style={styles.logoSub}>Smart expense tracking</Text>
        </View>

        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.sub}>Start tracking your expenses today</Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={styles.input} placeholder="Juan dela Cruz" placeholderTextColor="#5A5A54"
              value={name} onChangeText={setName} autoCapitalize="words"
            />
          </View>

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
                style={[styles.input, { flex: 1 }]} placeholder="Min. 6 characters" placeholderTextColor="#5A5A54"
                value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={[styles.input, confirm.length > 0 && confirm !== password && styles.inputError]}
              placeholder="Re-enter password" placeholderTextColor="#5A5A54"
              value={confirm} onChangeText={setConfirm} secureTextEntry={!showPassword} autoCapitalize="none"
            />
            {confirm.length > 0 && confirm !== password && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={submit} disabled={loading}
          >
            {loading ? <ActivityIndicator color="#0F0F0F" /> : <Text style={styles.btnText}>Create Account</Text>}
          </TouchableOpacity>
        </View>

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
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  inner: { padding: 24, paddingTop: 60, flexGrow: 1 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { fontSize: 48, marginBottom: 8 },
  logoTitle: { fontSize: 28, fontWeight: '800', color: '#C8F135', letterSpacing: -1 },
  logoSub: { fontSize: 13, color: '#5A5A54', marginTop: 4 },
  heading: { fontSize: 24, fontWeight: '700', color: '#F5F5F0', letterSpacing: -0.5 },
  sub: { fontSize: 13, color: '#9A9A92', marginTop: 4, marginBottom: 28 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 11, fontWeight: '600', color: '#5A5A54', letterSpacing: 1.2 },
  input: { backgroundColor: '#181818', borderRadius: 12, padding: 16, fontSize: 15, color: '#F5F5F0', borderWidth: 1, borderColor: '#2A2A2A' },
  inputError: { borderColor: '#FF6B6B' },
  errorText: { fontSize: 11, color: '#FF6B6B', marginTop: 2 },
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
