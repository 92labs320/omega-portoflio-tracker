import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/Colors';
import { isSyncEnabled } from '@/lib/sync';
import { useCurrencyStore } from '@/store/currencyStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useWatchlistStore } from '@/store/watchlistStore';

export default function RootLayout() {
  const load = usePortfolioStore((s) => s.load);
  const sync = usePortfolioStore((s) => s.sync);

  useEffect(() => {
    (async () => {
      useWatchlistStore.getState().load().catch(() => {});
      try {
        await load();
      } catch (e) {
        console.warn('Failed to open local database', e);
        return;
      }
      useCurrencyStore.getState().load().catch(() => {});
      if (await isSyncEnabled().catch(() => false)) {
        sync().catch(() => {});
      }
    })();
  }, [load, sync]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="add-transaction" options={{ presentation: 'modal' }} />
        <Stack.Screen name="asset/[key]" />
      </Stack>
    </>
  );
}
