import React from 'react';
import { Alert, Linking, Text } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { Group, NavRow, SettingsPage, settingsStyles } from '@/components/settings/SettingsUI';
import { Config } from '@/constants/Config';

const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('Could not open link', url));

export default function AboutSettings() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = Updates.updateId ? `${version} · update ${Updates.updateId.slice(0, 8)}` : version;

  return (
    <SettingsPage title="Support & About">
      <Group title="Help">
        <NavRow icon="lifebuoy" label="Help center" onPress={() => open(Config.supportUrl)} />
        <NavRow
          icon="email-outline"
          label="Contact us"
          value={Config.supportEmail}
          onPress={() => open(`mailto:${Config.supportEmail}?subject=Omega%20Portfolio%20Tracker`)}
        />
      </Group>

      <Group title="Market data">
        <NavRow icon="chart-line" label="Crypto prices & trending" value="CoinGecko" onPress={() => open('https://www.coingecko.com')} />
        <NavRow icon="finance" label="Stock prices & news" value="Finnhub" onPress={() => open('https://finnhub.io')} />
      </Group>
      <Text style={settingsStyles.note}>Quotes may be delayed and can differ from other sources.</Text>

      <Group title="Legal">
        <NavRow icon="shield-lock-outline" label="Privacy Policy" onPress={() => open(Config.privacyUrl)} />
        <NavRow icon="file-document-outline" label="Terms of Use" onPress={() => open(Config.termsUrl)} />
        <NavRow icon="information-outline" label="Version" value={build} />
      </Group>

      <Text style={settingsStyles.note}>
        Omega records the transactions you enter and shows market prices. It is not a broker, an exchange or financial
        advice, and it never holds or moves your assets.
      </Text>
    </SettingsPage>
  );
}
