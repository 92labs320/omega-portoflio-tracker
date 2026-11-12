import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Sub-page shell: back arrow, centered title, scrollable body. */
export function SettingsPage({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={26} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Group({ title, children, footer }: { title?: string; children: React.ReactNode; footer?: string }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.card}>
        {items.map((child, i) => (
          <View key={i} style={i < items.length - 1 ? styles.divider : undefined}>
            {child}
          </View>
        ))}
      </View>
      {footer ? <Text style={styles.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

/** Row with a chevron (navigation) or a value on the right. */
export function NavRow({
  icon,
  label,
  value,
  detail,
  onPress,
  destructive,
  right,
}: {
  icon?: IconName;
  label: string;
  /** Small text under the label. */
  detail?: string;
  /** Text on the right, before the chevron. */
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
}) {
  const color = destructive ? Colors.red : Colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? { opacity: 0.6 } : null]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={24} color={destructive ? Colors.red : Colors.accent} style={styles.icon} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textSecondary} /> : null)}
    </Pressable>
  );
}

export function ToggleRow({
  label,
  detail,
  value,
  onChange,
  disabled,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, disabled && { opacity: 0.45 }]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: Colors.accent, false: '#3A3A44' }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export const settingsStyles = StyleSheet.create({
  note: { color: Colors.textTertiary, fontSize: 12, lineHeight: 17, marginHorizontal: 20, marginTop: 12 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  headerTitle: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 22, fontWeight: '800' },
  group: { marginTop: 22 },
  groupTitle: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700', marginHorizontal: 20, marginBottom: 8 },
  groupFooter: { color: Colors.textTertiary, fontSize: 12, lineHeight: 17, marginHorizontal: 20, marginTop: 8 },
  card: { marginHorizontal: 16, backgroundColor: '#17171C', borderRadius: 16, overflow: 'hidden' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingHorizontal: 16, paddingVertical: 12 },
  icon: { marginRight: 14 },
  label: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  detail: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  value: { color: Colors.textSecondary, fontSize: 15, marginRight: 6, maxWidth: 160 },
});
