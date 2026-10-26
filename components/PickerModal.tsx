import React, { useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';

export interface PickerItem {
  key: string;
  label: string;
  sublabel?: string;
  /** Pinned items are shown above the A–Z sections (e.g. "Global avg."). */
  pinned?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  searchPlaceholder: string;
  items: PickerItem[];
  selectedKey?: string;
  /** Group by first letter like Delta's exchange list. */
  alphabetical?: boolean;
  /** Offer “Use "query"” when nothing matches (free-text platform). */
  allowCustom?: boolean;
  emptyText?: string;
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}

export function PickerModal({
  visible,
  title,
  searchPlaceholder,
  items,
  selectedKey,
  alphabetical,
  allowCustom,
  emptyText,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) => i.label.toLowerCase().includes(q) || (i.sublabel ?? '').toLowerCase().includes(q))
      : items;
    const pinned = filtered.filter((i) => i.pinned);
    const rest = filtered.filter((i) => !i.pinned);
    const out: { title: string | null; data: PickerItem[] }[] = [];
    if (pinned.length) out.push({ title: null, data: pinned });
    if (!alphabetical) {
      if (rest.length) out.push({ title: null, data: rest });
    } else {
      const groups = new Map<string, PickerItem[]>();
      for (const i of [...rest].sort((a, b) => a.label.localeCompare(b.label))) {
        const c = i.label.charAt(0).toUpperCase();
        const letter = /[A-Z]/.test(c) ? c : '#';
        groups.set(letter, [...(groups.get(letter) ?? []), i]);
      }
      for (const [letter, data] of groups) out.push({ title: letter, data });
    }
    const custom = query.trim();
    if (allowCustom && custom && !filtered.some((i) => i.label.toLowerCase() === custom.toLowerCase())) {
      out.push({ title: null, data: [{ key: `custom:${custom}`, label: `Use “${custom}”` }] });
    }
    return out;
  }, [items, query, alphabetical, allowCustom]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <MaterialCommunityIcons name="arrow-left" size={26} color={Colors.text} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.search}>
          <MaterialCommunityIcons name="magnify" size={22} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(i) => i.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setQuery('');
                onSelect(item);
              }}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, item.key === selectedKey && { color: Colors.accent }]}>{item.label}</Text>
                {item.sublabel ? <Text style={styles.rowSub}>{item.sublabel}</Text> : null}
              </View>
              {item.key === selectedKey ? (
                <MaterialCommunityIcons name="check" size={22} color={Colors.accent} />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textSecondary} />
              )}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText ?? 'No results'}</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  title: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 20, fontWeight: '800' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1C1C22',
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 17 },
  sectionHeader: { backgroundColor: '#1A1A1F', paddingHorizontal: 16, paddingVertical: 6 },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rowLabel: { color: Colors.text, fontSize: 17 },
  rowSub: { color: Colors.textTertiary, fontSize: 12, marginTop: 3 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40, paddingHorizontal: 32 },
});
