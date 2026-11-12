import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { authenticate, lockSupport } from '@/lib/biometrics';
import { usePrefsStore } from '@/store/prefsStore';

/** Ask again only after the app spent this long in the background. */
const GRACE_MS = 60_000;

/** Full-screen cover shown while the app is locked (Settings → Security). */
export function AppLock() {
  const enabled = usePrefsStore((s) => s.appLock);
  const loaded = usePrefsStore((s) => s.loaded);
  const [locked, setLocked] = useState(false);
  const [label, setLabel] = useState('Face ID');
  const backgroundAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await authenticate();
    prompting.current = false;
    if (ok) setLocked(false);
  }, []);

  // Lock on launch.
  useEffect(() => {
    if (!loaded || !enabled) {
      setLocked(false);
      return;
    }
    lockSupport().then((s) => {
      setLabel(s.label);
      if (s.available) {
        setLocked(true);
        unlock();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Lock again after a while in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (!usePrefsStore.getState().appLock) return;
      if (st === 'background') backgroundAt.current = Date.now();
      if (st === 'active' && backgroundAt.current && Date.now() - backgroundAt.current > GRACE_MS) {
        backgroundAt.current = null;
        setLocked(true);
        unlock();
      }
    });
    return () => sub.remove();
  }, [unlock]);

  if (!locked) return null;
  return (
    <View style={styles.cover}>
      <Text style={styles.brand}>Ω</Text>
      <Text style={styles.title}>Omega is locked</Text>
      <Pressable style={styles.btn} onPress={unlock} accessibilityRole="button">
        <MaterialCommunityIcons name={label === 'Face ID' ? 'face-recognition' : 'lock-open-variant-outline'} size={22} color={Colors.background} />
        <Text style={styles.btnText}>Unlock with {label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  brand: { color: Colors.accent, fontSize: 72, fontWeight: '800' },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: Colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 26,
  },
  btnText: { color: Colors.background, fontSize: 16, fontWeight: '800' },
});
