import React, { useState } from 'react';

import { PickerModal } from '@/components/PickerModal';
import { Group, NavRow, SettingsPage, ToggleRow } from '@/components/settings/SettingsUI';
import { CURRENCIES } from '@/lib/currency';
import { useCurrencyStore } from '@/store/currencyStore';
import { usePrefsStore } from '@/store/prefsStore';

export default function GeneralSettings() {
  const code = useCurrencyStore((s) => s.code);
  const rates = useCurrencyStore((s) => s.rates);
  const setCode = useCurrencyStore((s) => s.setCode);
  const hideBalances = usePrefsStore((s) => s.hideBalances);
  const setPref = usePrefsStore((s) => s.set);
  const [picker, setPicker] = useState(false);
  const current = CURRENCIES.find((c) => c.code === code);

  return (
    <SettingsPage title="General">
      <Group title="Display">
        <NavRow
          label="Currency"
          detail="Totals, prices and charts are converted at today’s rate."
          value={current ? `${current.code} · ${current.name}` : code}
          onPress={() => setPicker(true)}
        />
        <ToggleRow
          label="Hide balances"
          detail="Mask amounts on Home and Portfolio (the portfolio chart is hidden too). You can also tap the eye on Home."
          value={hideBalances}
          onChange={(v) => setPref('hideBalances', v)}
        />
      </Group>

      <PickerModal
        visible={picker}
        title="Display currency"
        searchPlaceholder="Search currency"
        items={CURRENCIES.filter((c) => c.code === 'USD' || rates[c.code]).map((c) => ({
          key: c.code,
          label: c.code,
          sublabel: c.name,
        }))}
        selectedKey={code}
        emptyText="Exchange rates unavailable right now."
        onSelect={(i) => {
          setCode(i.key);
          setPicker(false);
        }}
        onClose={() => setPicker(false)}
      />
    </SettingsPage>
  );
}
