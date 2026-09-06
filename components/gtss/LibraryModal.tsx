import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
    addCustomLibraryEntries,
    createEntryFromUrl,
    getBoundsForEntries,
    getSelectedLibraryUrls,
    importLibraryFeeds,
    loadLibrary,
    parseGtssZip,
    setSelectedLibraryUrls,
    type GtssLibraryEntry,
} from '@/lib/gtss/library';
import { saveFeed } from '@/lib/gtss/storage';
import type { MapBounds } from '@/lib/osm/overpass';

export interface LibraryModalProps {
    visible: boolean;
    onClose: (bounds?: MapBounds | null) => void;
}

// Shown on initial page load: lets the user browse the GTSS library and choose which
// feeds to load, add one by URL, or upload a library file of their own.
export default function LibraryModal({ visible, onClose }: LibraryModalProps) {
    const [entries, setEntries] = useState<GtssLibraryEntry[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [urlInput, setUrlInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function refresh() {
        const [loadedEntries, selectedUrls] = await Promise.all([loadLibrary(), getSelectedLibraryUrls()]);
        setEntries(loadedEntries);
        if (selectedUrls.length > 0) {
            setSelected(new Set(selectedUrls));
        } else {
            // Default: select all bundled library entries initially so feeds appear immediately.
            setSelected(new Set(loadedEntries.map((e) => e['gtss-url'])));
        }
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
        const result = await DocumentPicker.getDocumentAsync({
            type: ['application/json', 'application/zip', 'application/x-zip-compressed', '*/*'],
        });
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        try {
            if (asset.name.endsWith('.zip') || asset.mimeType?.includes('zip')) {
                const response = await fetch(asset.uri);
                const arrayBuffer = await response.arrayBuffer();
                const feeds = await parseGtssZip(arrayBuffer);
                for (const feed of feeds) {
                    await saveFeed(feed);
                }
                const newEntry = createEntryFromUrl(asset.name);
                newEntry.title = asset.name.replace(/\.zip$/i, '');
                await addCustomLibraryEntries([newEntry]);
                await refresh();
                setSelected((prev) => new Set(prev).add(newEntry['gtss-url']));
            } else {
                const text = await (await fetch(asset.uri)).text();
                const parsed = JSON.parse(text);
                const uploaded: GtssLibraryEntry[] = Array.isArray(parsed) ? parsed : [parsed];
                await addCustomLibraryEntries(uploaded);
                await refresh();
            }
        } catch {
            setError('Could not read that file as GTSS library data.');
        }
    }

    function handleCancel() {
        if (loading) return;
        onClose();
    }

    async function handleDone() {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const selectedUrls = [...selected];
            await setSelectedLibraryUrls(selectedUrls);

            if (selectedUrls.length === 0) {
                onClose(null);
                return;
            }

            const { bounds } = await importLibraryFeeds(selectedUrls);
            const selectedEntries = entries.filter((entry) => selected.has(entry['gtss-url']));
            const fallbackBounds = getBoundsForEntries(selectedEntries);
            onClose(bounds || fallbackBounds);
        } catch (err) {
            setError((err as Error)?.message || 'Failed to load selected GTSS feeds.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={handleCancel} transparent>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Load GTSS Files</Text>
                        <Pressable onPress={handleCancel} disabled={loading}>
                            <Text style={[styles.closeText, loading && styles.disabledText]}>Cancel</Text>
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
                                    <Pressable
                                        key={entry['gtss-url']}
                                        style={styles.row}
                                        onPress={() => toggle(entry['gtss-url'])}
                                        disabled={loading}
                                    >
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
                            editable={!loading}
                        />
                        <Pressable style={styles.addButton} onPress={handleAddUrl} disabled={loading}>
                            <Text style={styles.addButtonText}>Add</Text>
                        </Pressable>
                    </View>

                    <Pressable style={styles.uploadButton} onPress={handleUpload} disabled={loading}>
                        <Text style={styles.uploadButtonText}>Upload a library file&hellip;</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.doneButton, loading && styles.doneButtonDisabled]}
                        onPress={handleDone}
                        disabled={loading}
                    >
                        {loading ? (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator color="#fff" size="small" />
                                <Text style={styles.doneButtonText}>Loading feeds&hellip;</Text>
                            </View>
                        ) : (
                            <Text style={styles.doneButtonText}>
                                {selected.size === 0
                                    ? 'Skip'
                                    : `Load ${selected.size} ${selected.size === 1 ? 'feed' : 'feeds'}`}
                            </Text>
                        )}
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
    disabledText: { color: '#999' },
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
    doneButtonDisabled: { opacity: 0.7 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
