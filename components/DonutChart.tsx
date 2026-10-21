import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/Colors';

export interface DonutChartProps {
  data: Array<{
    value: number;
    label: string;
    color: string;
  }>;
}

export function DonutChart({ data }: DonutChartProps) {
  return (
    <View style={styles.container}>
      <PieChart
        data={data}
        donut
        radius={80}
        innerRadius={55}
        centerLabelComponent={() => null}
        textColor={Colors.text}
        backgroundColor={Colors.card}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
  },
});


