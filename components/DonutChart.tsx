import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { Colors } from '@/constants/Colors';

export interface DonutSlice {
  value: number;
  label: string;
  color: string;
}

/** Allocation donut with a legend. Values must be >= 0. */
export function DonutChart({ data, centerLabel }: { data: DonutSlice[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;
  const top = data.slice(0, 6);
  const rest = data.slice(6).reduce((s, d) => s + d.value, 0);
  const slices = rest > 0 ? [...top, { value: rest, label: 'Other', color: '#5A5A6E' }] : top;

  return (
    <View style={styles.container}>
      <PieChart
        data={slices.map((s) => ({ value: s.value, color: s.color }))}
        donut
        radius={70}
        innerRadius={50}
        innerCircleColor={Colors.card}
        backgroundColor={Colors.card}
        centerLabelComponent={() => (
          <Text style={styles.center}>{centerLabel ?? `${slices.length}`}</Text>
        )}
      />
      <View style={styles.legend}>
        {slices.map((s) => (
          <View key={s.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={styles.legendValue}>{((s.value / total) * 100).toFixed(1)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 16,
    marginHorizontal: 16,
    gap: 18,
  },
  center: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  legendLabel: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  legendValue: { color: Colors.textSecondary, fontSize: 12, marginLeft: 8 },
});
