import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listAgencies } from '@/lib/gtss/agencyStore';
import { exportGtssBundle } from '@/lib/gtss/export';
import { listAllFeeds } from '@/lib/gtss/storage';
import type { Agency, GtssFeed } from '@/lib/gtss/types';

export interface ExportModalProps {
    visible: boolean;
    onClose: () => void;
}

// Lets the user pick which agencies to include in a combined GTSS zip download.
export default function ExportModal({ visible, onClose }: ExportModalProps) {
    const [agencies, setAgencies] = useState<Agency[]>([]);
    const [feeds, setFeeds] = useState<GtssFeed[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!visible) return;
        (async () => {
            const [loadedAgencies, loadedFeeds] = await Promise.all([listAgencies(), listAllFeeds()]);
            setFeeds(loadedFeeds);
            // Union of configured agencies and agencies referenced by saved signals,
            // so signals whose agency was deleted still appear in the picker.
            const byId = new Map<string, Agency>();
            for (const agency of loadedAgencies) byId.set(agency.agencyId, agency);
            for (const feed of loadedFeeds) {
                if (!byId.has(feed.agency.agencyId)) byId.set(feed.agency.agencyId, feed.agency);
            }
            setAgencies([...byId.values()]);
            // Pre-select every agency that has at least one saved signal.
            setSelectedIds(new Set(loadedFeeds.map((feed) => feed.agency.agencyId)));
        })();
    }, [visible]);

    function toggle(agencyId: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(agencyId)) {
                next.delete(agencyId);
            } else {
                next.add(agencyId);
            }
            return next;
        });
    }

    const selectedFeeds = feeds.filter((feed) => selectedIds.has(feed.agency.agencyId));

    async function handleDownload() {
        if (selectedFeeds.length === 0) return;
        setExporting(true);
        try {
            await exportGtssBundle(selectedFeeds);
            onClose();
        } finally {
            setExporting(false);
        }
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Export GTSS</Text>
                        <Pressable onPress={onClose}>
                            <Text style={styles.closeText}>Cancel</Text>
                        </Pressable>
                    </View>

                    <Text style={styles.subtitle}>Choose which agencies to include in the GTSS file.</Text>

                    {feeds.length === 0 ? (
                        <Text style={styles.emptyText}>
                            No saved intersections yet. Select an intersection on the map to start building GTSS data.
                        </Text>
                    ) : (
                        <ScrollView style={styles.list}>
                            {agencies.map((agency) => {
                                const count = feeds.filter((feed) => feed.agency.agencyId === agency.agencyId).length;
                                const checked = selectedIds.has(agency.agencyId);
                                return (
                                    <Pressable key={agency.agencyId} style={styles.row} onPress={() => toggle(agency.agencyId)}>
                                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                                            {checked ? <Text style={styles.checkmark}>{'✓'}</Text> : null}
                                        </View>
                                        <View style={styles.rowInfo}>
                                            <Text style={styles.rowName}>{agency.agencyName || '(unnamed agency)'}</Text>
                                            <Text style={styles.rowSub}>{agency.agencyId}</Text>
                                        </View>
                                        <Text style={styles.rowCount}>
                                            {count} {count === 1 ? 'signal' : 'signals'}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}

                    <Pressable
                        style={[styles.downloadButton, (exporting || selectedFeeds.length === 0) && styles.downloadButtonDisabled]}
                        onPress={handleDownload}
                        disabled={exporting || selectedFeeds.length === 0}
                    >
                        <Text style={styles.downloadButtonText}>
                            {exporting
                                ? 'Exporting…'
                                : `Download ${selectedFeeds.length} ${selectedFeeds.length === 1 ? 'signal' : 'signals'}`}
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
    rowCount: { fontSize: 12, color: '#555' },
    emptyText: { fontSize: 13, color: '#777', paddingVertical: 16, textAlign: 'center' },
    downloadButton: {
        marginTop: 12,
        backgroundColor: '#1b8a3e',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    downloadButtonDisabled: { backgroundColor: '#9ec7ad' },
    downloadButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
