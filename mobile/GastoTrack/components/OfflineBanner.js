import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import useNetworkStatus from '../hooks/useNetworkStatus';
import { getQueue } from '../services/OfflineManager';

export default function OfflineBanner() {
  const { isOnline, isChecking } = useNetworkStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [showOnlineMsg, setShowOnlineMsg] = useState(false);
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const prevOnline = useRef(true);

  // Check queue count
  useEffect(() => {
    const check = async () => {
      const q = await getQueue();
      setQueueCount(q.length);
    };
    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  // Animate banner in/out
  useEffect(() => {
    if (isChecking) return;

    const shouldShow = !isOnline || showOnlineMsg;

    if (!isOnline && prevOnline.current) {
      // Just went offline
      prevOnline.current = false;
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
    } else if (isOnline && !prevOnline.current) {
      // Just came back online
      prevOnline.current = true;
      setShowOnlineMsg(true);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      setTimeout(() => {
        setShowOnlineMsg(false);
        Animated.timing(slideAnim, { toValue: -60, duration: 300, useNativeDriver: true }).start();
      }, 3000);
    } else if (!shouldShow) {
      Animated.timing(slideAnim, { toValue: -60, duration: 300, useNativeDriver: true }).start();
    }
  }, [isOnline, isChecking]);

  if (isChecking) return null;
  if (isOnline && !showOnlineMsg) return null;

  return (
    <Animated.View style={[
      styles.banner,
      isOnline ? styles.bannerOnline : styles.bannerOffline,
      { transform: [{ translateY: slideAnim }] },
    ]}>
      <Text style={styles.icon}>{isOnline ? '✅' : '📵'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {isOnline ? 'Back Online!' : 'You\'re Offline'}
        </Text>
        <Text style={styles.sub}>
          {isOnline
            ? 'Syncing your queued transactions...'
            : queueCount > 0
              ? `${queueCount} transaction${queueCount > 1 ? 's' : ''} queued — will sync when online`
              : 'Transactions will be saved locally'
          }
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bannerOffline: {
    backgroundColor: '#1A0A00',
    borderBottomColor: '#FF6B6B30',
  },
  bannerOnline: {
    backgroundColor: '#0A1A0A',
    borderBottomColor: '#C8F13530',
  },
  icon: { fontSize: 18 },
  title: { fontSize: 13, fontWeight: '700', color: '#F5F5F0' },
  sub: { fontSize: 11, color: '#9A9A92', marginTop: 1 },
});
