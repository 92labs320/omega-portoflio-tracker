import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/Colors';

type InfoRowProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
};

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={icon} size={21} color={Colors.accent} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardLabel}>{label}</Text>
          <Text style={styles.cardValue}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>App information and data preferences</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <InfoRow
            icon="information-outline"
            label="About Omega"
            value="An informational crypto and stock portfolio tracker by 92labs."
          />
          <InfoRow icon="cellphone" label="App Version" value="1.0.0" />
          <InfoRow icon="theme-light-dark" label="Appearance" value="Dark theme" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market Data</Text>
          <InfoRow
            icon="chart-line"
            label="Price Source"
            value="Crypto market prices are provided by CoinGecko."
          />
          <InfoRow
            icon="clock-outline"
            label="Price Timing"
            value="Quotes may be delayed and can differ from other market sources."
          />
        </View>

        <View style={styles.notice}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={22}
            color={Colors.accent}
          />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>Tracking only</Text>
            <Text style={styles.noticeText}>
              Omega displays market information and helps organize personal portfolio records.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>OMEGA</Text>
          <Text style={styles.footerText}>A 92labs product</Text>
          <Text style={styles.footerText}>Copyright 2026 Omega Portfolio Tracker</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 36,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  section: {
    marginTop: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 15,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(0,217,100,0.1)',
  },
  cardContent: {
    flex: 1,
    marginLeft: 13,
  },
  cardLabel: {
    ...Typography.subheadline,
    color: Colors.text,
    marginBottom: 4,
  },
  cardValue: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  notice: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(0,217,100,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,217,100,0.18)',
  },
  noticeContent: {
    flex: 1,
    marginLeft: 12,
  },
  noticeTitle: {
    ...Typography.subheadline,
    color: Colors.text,
    marginBottom: 5,
  },
  noticeText: {
    ...Typography.caption1,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 12,
  },
  footerBrand: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  footerText: {
    ...Typography.caption1,
    color: Colors.textTertiary,
    marginBottom: 3,
  },
});
