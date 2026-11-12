import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Group, SettingsPage, ToggleRow } from '@/components/settings/SettingsUI';
import { authenticate, lockSupport, type LockSupport } from '@/lib/biometrics';
import { usePrefsStore } from '@/store/prefsStore';

export default function SecuritySettings() {
  const appLock = usePrefsStore((s) => s.appLock);
  const setPref = usePrefsStore((s) => s.set);
  const [support, setSupport] = useState<LockSupport | null>(null);

  useEffect(() => {
    lockSupport().then(setSupport);
  }, []);

  const toggle = async (on: boolean) => {
    // Confirm it works before turning it on, and ask before turning it off.
    const ok = await authenticate(on ? 'Turn on app lock' : 'Turn off app lock');
    if (ok) setPref('appLock', on);
  };

  const label = support?.label ?? 'Face ID';
  const unavailable = support !== null && !support.available;

  return (
    <SettingsPage title="Security">
      <Group
        footer={
          unavailable
            ? 'Set up Face ID or a passcode in iOS Settings to use the app lock. If you just updated Omega, this option needs the latest version from the App Store or TestFlight.'
            : `Omega asks for ${label} when it opens and after one minute in the background. Your iPhone passcode works as a fallback.`
        }
      >
        <ToggleRow
          label={`Lock with ${label}`}
          value={appLock}
          disabled={unavailable}
          onChange={(v) =>
            toggle(v).catch(() => Alert.alert('Could not change the app lock', 'Try again.'))
          }
        />
      </Group>
    </SettingsPage>
  );
}
