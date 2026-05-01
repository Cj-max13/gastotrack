/**
 * GastoAvatar — Glowing blob character.
 * Fixed: uses scaleY instead of height animation to avoid native driver errors.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

const C = {
  bodyLight:  '#00E5FF',
  bodyMid:    '#00BCD4',
  bodyDark:   '#0097A7',
  bodyGlow:   '#40E0D0',
  outline:    '#0A1628',
  hairLight:  '#29B6F6',
  hairDark:   '#0288D1',
  eyeWhite:   '#FFFFFF',
  eyePupil:   '#0A1628',
  cheek:      '#80DEEA',
  smile:      '#0A1628',
  accent:     '#C8F135',
};

export default function GastoAvatar({ size = 130, talking = false, thinking = false }) {
  const s = size / 130;

  const floatY     = useRef(new Animated.Value(0)).current;
  const wobbleX    = useRef(new Animated.Value(0)).current;
  const glowPulse  = useRef(new Animated.Value(0.7)).current;
  const blinkL     = useRef(new Animated.Value(1)).current;  // scaleY for left eye
  const blinkR     = useRef(new Animated.Value(1)).current;  // scaleY for right eye
  const mouthScale = useRef(new Animated.Value(0.3)).current; // scaleY for mouth
  const hairBounce = useRef(new Animated.Value(0)).current;
  const thinkScale = useRef(new Animated.Value(0)).current;
  const ringPulse  = useRef(new Animated.Value(1)).current;

  // Float
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: -9, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatY, { toValue: 9,  duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);

  // Wobble
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(wobbleX, { toValue: 3,  duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(wobbleX, { toValue: -3, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);

  // Glow pulse — useNativeDriver: false because it's opacity on a non-native prop
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowPulse, { toValue: 1,   duration: 1000, useNativeDriver: false }),
      Animated.timing(glowPulse, { toValue: 0.5, duration: 1000, useNativeDriver: false }),
    ])).start();
  }, []);

  // Hair bounce
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(hairBounce, { toValue: -3, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(hairBounce, { toValue: 3,  duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);

  // Blink — scaleY on native driver
  useEffect(() => {
    const blink = () => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(blinkL, { toValue: 0.05, duration: 65, useNativeDriver: true }),
          Animated.timing(blinkL, { toValue: 1,    duration: 65, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(blinkR, { toValue: 0.05, duration: 65, useNativeDriver: true }),
          Animated.timing(blinkR, { toValue: 1,    duration: 65, useNativeDriver: true }),
        ]),
      ]).start(() => setTimeout(blink, 2200 + Math.random() * 2000));
    };
    const t = setTimeout(blink, 1500);
    return () => clearTimeout(t);
  }, []);

  // Talking mouth — scaleY on native driver
  useEffect(() => {
    if (talking) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(mouthScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
        Animated.timing(mouthScale, { toValue: 0.3, duration: 150, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      Animated.timing(mouthScale, { toValue: 0.3, duration: 100, useNativeDriver: true }).start();
    }
  }, [talking]);

  // Thinking
  useEffect(() => {
    if (thinking) {
      Animated.spring(thinkScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }).start();
      Animated.loop(Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ])).start();
    } else {
      Animated.timing(thinkScale, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      ringPulse.setValue(1);
    }
  }, [thinking]);

  return (
    <Animated.View style={[styles.root, {
      transform: [{ translateY: floatY }, { translateX: wobbleX }],
    }]}>

      {/* Glow ring */}
      <Animated.View style={[styles.glowRing, {
        width: 112 * s, height: 112 * s, borderRadius: 56 * s,
        borderColor: thinking ? C.accent : C.bodyLight,
        opacity: glowPulse,
        transform: [{ scale: ringPulse }],
      }]} />

      {/* Hair */}
      <Animated.View style={[styles.hairLayer, { transform: [{ translateY: hairBounce }] }]}>
        <View style={[styles.hairSpike, { width: 28 * s, height: 32 * s, borderRadius: 14 * s, backgroundColor: C.bodyLight, top: 0, left: 42 * s, borderWidth: 2 * s, borderColor: C.outline }]} />
        <View style={[styles.hairSpike, { width: 24 * s, height: 28 * s, borderRadius: 12 * s, backgroundColor: C.hairLight, top: 6 * s, left: 20 * s, borderWidth: 2 * s, borderColor: C.outline }]} />
        <View style={[styles.hairSpike, { width: 20 * s, height: 22 * s, borderRadius: 10 * s, backgroundColor: C.hairDark, top: 14 * s, left: 5 * s, borderWidth: 2 * s, borderColor: C.outline }]} />
        <View style={[styles.hairSpike, { width: 24 * s, height: 28 * s, borderRadius: 12 * s, backgroundColor: C.hairLight, top: 6 * s, left: 68 * s, borderWidth: 2 * s, borderColor: C.outline }]} />
        <View style={[styles.hairSpike, { width: 20 * s, height: 22 * s, borderRadius: 10 * s, backgroundColor: C.hairDark, top: 14 * s, left: 87 * s, borderWidth: 2 * s, borderColor: C.outline }]} />
      </Animated.View>

      {/* Body */}
      <View style={[styles.body, {
        width: 110 * s, height: 108 * s, borderRadius: 54 * s,
        backgroundColor: C.bodyMid,
        borderWidth: 3 * s, borderColor: C.outline,
        marginTop: 10 * s,
      }]}>

        {/* Face glow */}
        <Animated.View style={[styles.faceGlow, {
          width: 72 * s, height: 72 * s, borderRadius: 36 * s,
          backgroundColor: C.bodyGlow,
          opacity: glowPulse,
          top: 14 * s,
        }]} />

        {/* Highlights */}
        <View style={[styles.highlight, { width: 18 * s, height: 22 * s, borderRadius: 9 * s, top: 8 * s, left: 18 * s, opacity: 0.4 }]} />
        <View style={[styles.highlight, { width: 10 * s, height: 12 * s, borderRadius: 5 * s, top: 6 * s, left: 38 * s, opacity: 0.25 }]} />

        {/* Eyes */}
        <View style={[styles.eyeRow, { marginTop: 28 * s, gap: 18 * s }]}>
          {/* Left eye */}
          <View style={[styles.eyeOuter, {
            width: 26 * s, height: 26 * s, borderRadius: 13 * s,
            borderWidth: 2.5 * s, borderColor: C.outline,
          }]}>
            <Animated.View style={[styles.eyePupil, {
              width: 18 * s, height: 18 * s, borderRadius: 9 * s,
              backgroundColor: C.eyePupil,
              transform: [{ scaleY: blinkL }],
            }]} />
            <View style={[styles.eyeShine, { width: 7 * s, height: 7 * s, borderRadius: 4 * s, top: 3 * s, right: 3 * s }]} />
            <View style={[styles.eyeShine, { width: 4 * s, height: 4 * s, borderRadius: 2 * s, top: 10 * s, right: 6 * s, opacity: 0.6 }]} />
          </View>

          {/* Right eye */}
          <View style={[styles.eyeOuter, {
            width: 26 * s, height: 26 * s, borderRadius: 13 * s,
            borderWidth: 2.5 * s, borderColor: C.outline,
          }]}>
            <Animated.View style={[styles.eyePupil, {
              width: 18 * s, height: 18 * s, borderRadius: 9 * s,
              backgroundColor: C.eyePupil,
              transform: [{ scaleY: blinkR }],
            }]} />
            <View style={[styles.eyeShine, { width: 7 * s, height: 7 * s, borderRadius: 4 * s, top: 3 * s, right: 3 * s }]} />
            <View style={[styles.eyeShine, { width: 4 * s, height: 4 * s, borderRadius: 2 * s, top: 10 * s, right: 6 * s, opacity: 0.6 }]} />
          </View>
        </View>

        {/* Cheeks */}
        <View style={[styles.cheekRow, { marginTop: 4 * s }]}>
          <View style={{ width: 16 * s, height: 9 * s, borderRadius: 8 * s, backgroundColor: C.cheek, opacity: 0.5 }} />
          <View style={{ width: 16 * s, height: 9 * s, borderRadius: 8 * s, backgroundColor: C.cheek, opacity: 0.5 }} />
        </View>

        {/* Mouth */}
        <View style={[styles.mouthWrap, { marginTop: 6 * s }]}>
          <Animated.View style={[styles.mouthArc, {
            width: 30 * s, height: 14 * s,
            borderRadius: 15 * s,
            borderWidth: 2.5 * s,
            borderColor: C.smile,
            borderTopWidth: 0,
            transform: [{ scaleY: mouthScale }],
          }]} />
        </View>

      </View>

      {/* Thinking dots */}
      <Animated.View style={[styles.thinkRow, {
        transform: [{ scale: thinkScale }],
        top: 4 * s, right: -4 * s,
      }]}>
        {[5, 7, 9].map((d, i) => (
          <View key={i} style={{
            width: d * s, height: d * s, borderRadius: (d * s) / 2,
            backgroundColor: C.accent,
            marginLeft: 3 * s,
            opacity: 0.4 + i * 0.3,
          }} />
        ))}
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', position: 'relative' },

  glowRing: {
    position: 'absolute',
    borderWidth: 2,
    top: 8,
  },

  hairLayer: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%',
    height: 60,
  },
  hairSpike: { position: 'absolute' },

  body: {
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },

  faceGlow: {
    position: 'absolute',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },

  highlight: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-20deg' }],
  },

  eyeRow: { flexDirection: 'row', alignItems: 'center' },
  eyeOuter: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  eyePupil: {},
  eyeShine: { position: 'absolute', backgroundColor: '#FFFFFF' },

  cheekRow: { flexDirection: 'row', justifyContent: 'space-between', width: '70%' },

  mouthWrap: { alignItems: 'center' },
  mouthArc: { backgroundColor: 'transparent' },

  thinkRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
