import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { MONTHS_LONG, formatTradeDate } from '@/lib/format';

const ITEM_H = 40;
const VISIBLE = 5;

function Wheel({ values, value, onChange, format }: { values: number[]; value: number; onChange: (v: number) => void; format: (v: number) => string }) {
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, values.indexOf(value));

  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    // only when the list itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.length]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    if (values[i] !== value) onChange(values[i]);
  };

  return (
    <View style={styles.wheel}>
      <View pointerEvents="none" style={styles.wheelBand} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * ITEM_H }}
        contentContainerStyle={{ paddingVertical: ITEM_H * ((VISIBLE - 1) / 2) }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={(e) => {
          if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e);
        }}
      >
        {values.map((v) => (
          <Pressable
            key={v}
            style={styles.wheelItem}
            onPress={() => {
              onChange(v);
              ref.current?.scrollTo({ y: values.indexOf(v) * ITEM_H, animated: true });
            }}
          >
            <Text style={[styles.wheelText, v === value && styles.wheelTextOn]}>{format(v)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n: number) => String(n).padStart(2, '0');

interface Props {
  visible: boolean;
  value: number;
  onChange: (ts: number) => void;
  onClose: () => void;
}

/** Calendar + hour/minute wheels. Future times are not allowed. */
export function DateTimeSheet({ visible, value, onChange, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(new Date(value));
  const [month, setMonth] = useState(new Date(new Date(value).getFullYear(), new Date(value).getMonth(), 1));

  useEffect(() => {
    if (visible) {
      const d = new Date(value);
      setDraft(d);
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [visible, value]);

  const now = new Date();
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (number | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= count; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);

  const isFutureDay = (d: number) =>
    new Date(month.getFullYear(), month.getMonth(), d) > new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= now;

  const setDay = (d: number) => {
    const n = new Date(draft);
    n.setFullYear(month.getFullYear(), month.getMonth(), d);
    setDraft(n);
  };
  const setTime = (h: number | null, m: number | null) => {
    const n = new Date(draft);
    if (h !== null) n.setHours(h);
    if (m !== null) n.setMinutes(m);
    n.setSeconds(0, 0);
    setDraft(n);
  };

  const done = () => {
    const ts = Math.min(draft.getTime(), Date.now());
    onChange(ts);
    onClose();
  };

  const setNow = () => {
    onChange(Date.now());
    onClose();
  };

  const future = draft.getTime() > Date.now();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.sheetTitle}>Date & time</Text>
          <Pressable onPress={setNow} hitSlop={10}>
            <Text style={styles.now}>Now</Text>
          </Pressable>
        </View>

        <View style={styles.monthRow}>
          <Pressable
            onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            hitSlop={10}
            accessibilityLabel="Previous month"
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.monthText}>
            {MONTHS_LONG[month.getMonth()]} {month.getFullYear()}
          </Text>
          <Pressable
            onPress={() => canNext && setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            hitSlop={10}
            disabled={!canNext}
            accessibilityLabel="Next month"
          >
            <MaterialCommunityIcons name="chevron-right" size={28} color={canNext ? Colors.text : Colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {DOW.map((d) => (
            <Text key={d} style={styles.dow}>
              {d}
            </Text>
          ))}
          {days.map((d, i) => {
            if (d === null) return <View key={`e${i}`} style={styles.cell} />;
            const selected =
              draft.getFullYear() === month.getFullYear() && draft.getMonth() === month.getMonth() && draft.getDate() === d;
            const today =
              now.getFullYear() === month.getFullYear() && now.getMonth() === month.getMonth() && now.getDate() === d;
            const disabled = isFutureDay(d);
            return (
              <Pressable key={d} style={styles.cell} onPress={() => !disabled && setDay(d)} disabled={disabled}>
                <View style={[styles.dayBubble, selected && styles.daySelected, !selected && today && styles.dayToday]}>
                  <Text
                    style={[
                      styles.dayText,
                      disabled && { color: Colors.textTertiary },
                      selected && { color: Colors.background, fontWeight: '800' },
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>Time</Text>
          <View style={styles.wheels}>
            <Wheel values={HOURS} value={draft.getHours()} onChange={(h) => setTime(h, null)} format={pad} />
            <Text style={styles.colon}>:</Text>
            <Wheel values={MINUTES} value={draft.getMinutes()} onChange={(m) => setTime(null, m)} format={pad} />
          </View>
        </View>

        <Text style={[styles.preview, future && { color: Colors.orange }]}>
          {future ? 'Future time — will be set to now' : formatTradeDate(draft.getTime())}
        </Text>

        <Pressable style={styles.doneBtn} onPress={done} accessibilityRole="button">
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: '#111116',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  cancel: { color: Colors.textSecondary, fontSize: 16 },
  now: { color: Colors.accent, fontSize: 16, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  monthText: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: `${100 / 7}%`, textAlign: 'center', color: Colors.textTertiary, fontSize: 12, marginBottom: 6 },
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: Colors.accent },
  dayToday: { borderWidth: 1, borderColor: Colors.accent },
  dayText: { color: Colors.text, fontSize: 16 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  timeLabel: { color: Colors.text, fontSize: 16, fontWeight: '700', width: 60 },
  wheels: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colon: { color: Colors.text, fontSize: 22, fontWeight: '800', marginHorizontal: 8 },
  wheel: { width: 76, height: ITEM_H * VISIBLE, overflow: 'hidden' },
  wheelBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_H * ((VISIBLE - 1) / 2),
    height: ITEM_H,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  wheelText: { color: Colors.textTertiary, fontSize: 20 },
  wheelTextOn: { color: Colors.text, fontWeight: '800', fontSize: 22 },
  preview: { color: Colors.textSecondary, textAlign: 'center', marginTop: 8, fontSize: 13 },
  doneBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: Colors.background, fontSize: 17, fontWeight: '800' },
});
