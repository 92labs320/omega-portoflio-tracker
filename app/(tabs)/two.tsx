import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function TwoScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Text>This screen is not used</Text>
    </View>
  );
}


