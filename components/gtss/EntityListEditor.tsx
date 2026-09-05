import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export interface Column<T> {
  key: keyof T & string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: (string | number)[];
}

interface EntityListEditorProps<T> {
  title: string;
  rows: T[];
  columns: Column<T>[];
  createRow: () => T;
  onChange: (rows: T[]) => void;
}

export default function EntityListEditor<T>({
  title,
  rows,
  columns,
  createRow,
  onChange,
}: EntityListEditorProps<T>) {
  function updateRow(index: number, key: keyof T, value: unknown) {
    const next = rows.slice();
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  function removeRow(index: number) {
    const next = rows.slice();
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable style={styles.addButton} onPress={() => onChange([...rows, createRow()])}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? <Text style={styles.emptyText}>No entries yet.</Text> : null}

      {rows.map((row, index) => (
        <View key={index} style={styles.card}>
          {columns.map((col) => (
            <View key={col.key} style={styles.field}>
              <Text style={styles.fieldLabel}>{col.label}</Text>
              {col.type === 'select' ? (
                <View style={styles.chipRow}>
                  {col.options?.map((option) => {
                    const selected = row[col.key] === option;
                    return (
                      <Pressable
                        key={String(option)}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => updateRow(index, col.key, option)}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {String(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : col.type === 'boolean' ? (
                <Pressable
                  style={[styles.chip, row[col.key] === true && styles.chipSelected]}
                  onPress={() => updateRow(index, col.key, !row[col.key])}
                >
                  <Text style={[styles.chipText, row[col.key] === true && styles.chipTextSelected]}>
                    {row[col.key] === true ? 'true' : 'false'}
                  </Text>
                </Pressable>
              ) : (
                <TextInput
                  style={styles.input}
                  value={row[col.key] === undefined || row[col.key] === null ? '' : String(row[col.key])}
                  keyboardType={col.type === 'number' ? 'numeric' : 'default'}
                  onChangeText={(text) =>
                    updateRow(index, col.key, col.type === 'number' ? Number(text) || 0 : text)
                  }
                />
              )}
            </View>
          ))}
          <Pressable style={styles.removeButton} onPress={() => removeRow(index)}>
            <Text style={styles.removeButtonText}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  addButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: '#888', fontStyle: 'italic' },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  field: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, color: '#555', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  chipSelected: { backgroundColor: '#2c3e50', borderColor: '#2c3e50' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff' },
  removeButton: { alignSelf: 'flex-start', marginTop: 4 },
  removeButtonText: { color: '#b00020', fontWeight: '600' },
});
