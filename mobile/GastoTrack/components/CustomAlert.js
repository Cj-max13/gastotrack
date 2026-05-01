/**
 * CustomAlert — replaces native Alert.alert() with a styled modal
 * matching the app's dark theme (as seen in the Transaction Saved design).
 *
 * Usage:
 *   const { alertProps, showAlert } = useCustomAlert();
 *   ...
 *   showAlert({ icon:'⚠️', title:'Oops', message:'Something went wrong', buttons:[{text:'OK'}] });
 *   ...
 *   <CustomAlert {...alertProps} />
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated,
} from 'react-native';

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useCustomAlert() {
  const [alertProps, setAlertProps] = useState({ visible: false });

  const showAlert = useCallback(({ icon, title, message, buttons = [{ text: 'OK' }] }) => {
    setAlertProps({ visible: true, icon, title, message, buttons });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertProps((prev) => ({ ...prev, visible: false }));
  }, []);

  return { alertProps: { ...alertProps, onHide: hideAlert }, showAlert };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CustomAlert({ visible, icon, title, message, buttons = [], onHide }) {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const onShow = () => {
    scaleAnim.setValue(0.85);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleButton = (btn) => {
    onHide();
    if (btn.onPress) btn.onPress();
  };

  // Determine icon background color based on type
  const iconBg = (() => {
    if (!icon) return '#2A2A2A';
    if (icon.includes('✅') || icon.includes('🎉') || icon.includes('💾')) return '#1A2E1A';
    if (icon.includes('⚠️') || icon.includes('🚨'))  return '#2E1A00';
    if (icon.includes('❌') || icon.includes('💥'))   return '#2E1A1A';
    if (icon.includes('ℹ️') || icon.includes('💡'))   return '#1A1A2E';
    return '#1E1E1E';
  })();

  const iconBorder = (() => {
    if (!icon) return '#2A2A2A';
    if (icon.includes('✅') || icon.includes('🎉')) return '#C8F13550';
    if (icon.includes('⚠️') || icon.includes('🚨')) return '#FFB34750';
    if (icon.includes('❌') || icon.includes('💥')) return '#FF6B6B50';
    return '#2A2A2A';
  })();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onHide}
      onShow={onShow}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[
          styles.card,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}>

          {/* Icon */}
          {icon && (
            <View style={[styles.iconWrap, { backgroundColor: iconBg, borderColor: iconBorder }]}>
              <Text style={styles.iconText}>{icon}</Text>
            </View>
          )}

          {/* Title */}
          {title && <Text style={styles.title}>{title}</Text>}

          {/* Message */}
          {message && <Text style={styles.message}>{message}</Text>}

          {/* Buttons */}
          <View style={[styles.btnRow, buttons.length === 1 && styles.btnRowSingle]}>
            {buttons.map((btn, i) => {
              const isPrimary = btn.primary || (buttons.length === 1) ||
                (buttons.length > 1 && i === buttons.length - 1 && btn.style !== 'cancel');
              const isDestructive = btn.style === 'destructive';

              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    isPrimary && !isDestructive && styles.btnPrimary,
                    isDestructive && styles.btnDestructive,
                    !isPrimary && !isDestructive && styles.btnSecondary,
                    buttons.length === 1 && styles.btnFull,
                  ]}
                  onPress={() => handleButton(btn)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.btnText,
                    isPrimary && !isDestructive && styles.btnTextPrimary,
                    isDestructive && styles.btnTextDestructive,
                    !isPrimary && !isDestructive && styles.btnTextSecondary,
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },

  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  iconText: { fontSize: 36 },

  title: {
    fontSize: 20, fontWeight: '700', color: '#F5F5F0',
    textAlign: 'center', marginBottom: 8, letterSpacing: -0.3,
  },
  message: {
    fontSize: 14, color: '#9A9A92', textAlign: 'center',
    lineHeight: 22, marginBottom: 24,
  },

  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btnRowSingle: { justifyContent: 'center' },
  btn: { flex: 1, borderRadius: 14, padding: 15, alignItems: 'center' },
  btnFull: { flex: 1 },

  btnPrimary: { backgroundColor: '#C8F135' },
  btnSecondary: { backgroundColor: '#252525', borderWidth: 1, borderColor: '#333' },
  btnDestructive: { backgroundColor: '#2E1A1A', borderWidth: 1, borderColor: '#FF6B6B40' },

  btnText: { fontSize: 15, fontWeight: '700' },
  btnTextPrimary: { color: '#0F0F0F' },
  btnTextSecondary: { color: '#F5F5F0' },
  btnTextDestructive: { color: '#FF6B6B' },
});
