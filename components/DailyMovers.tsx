import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Colors, Typography } from '@/constants/Colors';

export interface DailyMover {
  symbol: string;
  change: number;
  value: number;
}

export interface DailyMoversProps {
  data: DailyMover[];
}

export function DailyMovers({ data }: DailyMoversProps) {
  const chartData = data.slice(0, 5).map((item) => ({
    value: Math.abs(item.change),
    label: item.symbol,
    frontColor: item.change >= 0 ? Colors.green : Colors.red,
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Top Daily Movers</Text>
      {chartData.length > 0 ? (
        <BarChart
          data={chartData}
          barWidth={32}
          height={200}
          width={350}
          spacing={12}
          xAxisLabelTextStyle={{ color: Colors.textSecondary, fontSize: 12 }}
          yAxisTextStyle={{ color: Colors.textSecondary, fontSize: 12 }}
          backgroundColor={Colors.card}
          xAxisColor={Colors.border}
          yAxisColor={Colors.border}
        />
      ) : (
        <Text style={styles.emptyText}>No movers available</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  title: {
    ...Typography.headline,
    color: Colors.text,
    marginBottom: 12,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});


