import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
    addCustomLibraryEntries,
    createEntryFromUrl,
    getSelectedLibraryUrls,
    loadLibrary,
    setSelectedLibraryUrls,
    type GtssLibraryEntry,
} from '@/lib/gtss/library';

export interface LibraryModalProps {
    visible: boolean;
    onClose: () => void;
}

// Shown on initial page load: lets the user browse the GTSS library and choose which
// feeds to load, add one by URL, or upload a library file of their own.
export default function LibraryModal({ visible, onClose }: LibraryModalProps) {
    const [entries, setEntries] = useState<GtssLibraryEntry[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [urlInput, setUrlInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    async function refresh() {
        const [loadedEntries, selectedUrls] = await Promise.all([loadLibrary(), getSelectedLibraryUrls()]);
        setEntries(loadedEntries);
        setSelected(new Set(selectedUrls));
    }

    useEffect(() => {
        if (!visible) return;
        setError(null);
        refresh();
    }, [visible]);

    function toggle(gtssUrl: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(gtssUrl)) {
                next.delete(gtssUrl);
            } else {
                next.add(gtssUrl);
            }
            return next;
        });
    }

    async function handleAddUrl() {
        const url = urlInput.trim();
        if (!url) return;
        try {
            new URL(url);
        } catch {
            setError('Enter a valid URL.');
            return;
        }
        setError(null);
        await addCustomLibraryEntries([createEntryFromUrl(url)]);
        setUrlInput('');
        await refresh();
        setSelected((prev) => new Set(prev).add(url));
    }

    async function handleUpload() {
        setError(null);
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
        if (result.canceled || !result.assets?.[0]) return;
        try {
            const text = await (await fetch(result.assets[0].uri)).text();
            const parsed = JSON.parse(text);
            const uploaded: GtssLibraryEntry[] = Array.isArray(parsed) ? parsed : [parsed];
            await addCustomLibraryEntries(uploaded);
            await refresh();
        } catch {
            setError('Could not read that file as a GTSS library JSON.');
        }
    }

    async function handleDone() {
        await setSelectedLibraryUrls([...selected]);
        onClose();
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Load GTSS Files</Text>
                        <Pressable onPress={onClose}>
                            <Text style={styles.closeText}>Cancel</Text>
                        </Pressable>
                    </View>

                    <Text style={styles.subtitle}>Choose which GTSS feeds to load.</Text>

                    <ScrollView style={styles.list}>
                        {entries.length === 0 ? (
                            <Text style={styles.emptyText}>No GTSS feeds available yet.</Text>
                        ) : (
                            entries.map((entry) => {
                                const checked = selected.has(entry['gtss-url']);
                                return (
                                    <Pressable key={entry['gtss-url']} style={styles.row} onPress={() => toggle(entry['gtss-url'])}>
                                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                                            {checked ? <Text style={styles.checkmark}>{'✓'}</Text> : null}
                                        </View>
                                        <View style={styles.rowInfo}>
                                            <Text style={styles.rowName}>
                                                {entry.title}
                                                {entry.official ? '  \u2022  Official' : ''}
                                            </Text>
                                            <Text style={styles.rowSub} numberOfLines={1}>
                                                {entry['gtss-url']}
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            })
                        )}
                    </ScrollView>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <View style={styles.addRow}>
                        <TextInput
                            style={styles.urlInput}
                            placeholder="Add a GTSS URL"
                            value={urlInput}
                            onChangeText={setUrlInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                        />
                        <Pressable style={styles.addButton} onPress={handleAddUrl}>
                            <Text style={styles.addButtonText}>Add</Text>
                        </Pressable>
                    </View>

                    <Pressable style={styles.uploadButton} onPress={handleUpload}>
                        <Text style={styles.uploadButtonText}>Upload a library file&hellip;</Text>
                    </Pressable>

                    <Pressable style={styles.doneButton} onPress={handleDone}>
                        <Text style={styles.doneButtonText}>
                            {selected.size === 0 ? 'Skip' : `Load ${selected.size} ${selected.size === 1 ? 'feed' : 'feeds'}`}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '85%',
        padding: 16,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontSize: 18, fontWeight: '700' },
    closeText: { color: '#2c3e50', fontWeight: '600', fontSize: 15 },
    subtitle: { fontSize: 13, color: '#555', marginBottom: 8 },
    list: { flexGrow: 0 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        gap: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#bbb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: { borderColor: '#2c3e50', backgroundColor: '#2c3e50' },
    checkmark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 14, fontWeight: '600', color: '#222' },
    rowSub: { fontSize: 12, color: '#777', marginTop: 2 },
    emptyText: { fontSize: 13, color: '#777', paddingVertical: 16, textAlign: 'center' },
    errorText: { fontSize: 12, color: '#c0392b', marginTop: 8 },
    addRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
    urlInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 10,
        fontSize: 14,
    },
    addButton: {
        backgroundColor: '#2c3e50',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    uploadButton: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
    uploadButtonText: { color: '#2c3e50', fontWeight: '600', fontSize: 14 },
    doneButton: {
        marginTop: 8,
        backgroundColor: '#1b8a3e',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
