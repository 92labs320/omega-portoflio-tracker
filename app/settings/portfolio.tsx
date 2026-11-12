import React from 'react';
import { Alert } from 'react-native';

import { Group, NavRow, SettingsPage, ToggleRow } from '@/components/settings/SettingsUI';
import { PORTFOLIO_RANGES, RANGE_LABEL } from '@/lib/history';
import { usePrefsStore } from '@/store/prefsStore';

export default function PortfolioSettings() {
  const prefs = usePrefsStore();

  const chooseRange = () =>
    Alert.alert('Default time range', 'Shown when you open Portfolio.', [
      ...PORTFOLIO_RANGES.map((r) => ({ text: RANGE_LABEL[r], onPress: () => prefs.set('defaultRange', r) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  return (
    <SettingsPage title="Portfolio">
      <Group>
        <ToggleRow
          label="Show portfolio chart"
          value={prefs.showPortfolioChart}
          onChange={(v) => prefs.set('showPortfolioChart', v)}
        />
        <NavRow label="Default time range" value={RANGE_LABEL[prefs.defaultRange]} onPress={chooseRange} />
        <ToggleRow
          label="Hide small holdings"
          detail="Hide positions worth less than 1 USD (dust left on exchanges)."
          value={prefs.hideSmallHoldings}
          onChange={(v) => prefs.set('hideSmallHoldings', v)}
        />
      </Group>
    </SettingsPage>
  );
}
