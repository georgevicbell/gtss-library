import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface TabOption<T extends string> {
  key: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  options: TabOption<T>[];
  active: T;
  onChange: (key: T) => void;
}

// A minimal segmented tab bar (no external nav library needed).
export default function Tabs<T extends string>({ options, active, onChange }: TabsProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = opt.key === active;
        return (
          <Pressable key={opt.key} style={[styles.tab, selected && styles.tabSelected]} onPress={() => onChange(opt.key)}>
            <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
              {opt.label}
              {opt.count !== undefined ? ` (${opt.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  tabSelected: { backgroundColor: '#2c3e50' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#333' },
  tabTextSelected: { color: '#fff' },
});
