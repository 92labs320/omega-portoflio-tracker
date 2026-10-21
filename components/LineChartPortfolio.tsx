import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/Colors';

export interface LineChartPortfolioProps {
  data: Array<{
    value: number;
    dataPointLabelComponent?: () => React.ReactNode;
  }>;
  height?: number;
  width?: number;
}

export function LineChartPortfolio({
  data,
  height = 250,
  width = 350,
}: LineChartPortfolioProps) {
  return (
    <View style={styles.container}>
      <LineChart
        data={data}
        height={height}
        width={width}
        color={Colors.green}
        thickness={2}
        startFillColor={Colors.green}
        endFillColor={Colors.green}
        startOpacity={0.3}
        endOpacity={0}
        curved
        hideDataPoints
        textColor={Colors.textSecondary}
        backgroundColor={Colors.card}
        xAxisColor={Colors.border}
        yAxisColor={Colors.border}
        yAxisTextStyle={{ color: Colors.textSecondary, fontSize: 12 }}
        xAxisLabelTextStyle={{ color: Colors.textSecondary, fontSize: 12 }}
      />
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
    alignItems: 'center',
  },
});


