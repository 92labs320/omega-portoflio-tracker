import { Stack } from 'expo-router';

import { Colors } from '@/constants/Colors';

export default function AddTransactionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
