import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import Map, { type MapFocusTarget } from '@/components/Map';
import AgencyModal from '@/components/gtss/AgencyModal';
import ExportModal from '@/components/gtss/ExportModal';
import LibraryModal from '@/components/gtss/LibraryModal';
import { deleteFeed, listAllFeeds } from '@/lib/gtss/storage';
import type { TrafficSignalNode } from '@/lib/osm/overpass';

interface SignalListItem {
    signalId: string;
    agencyName: string;
    streetName1: string;
    streetName2: string;
    latitude: number;
    longitude: number;
}

interface AgencySection {
    agencyName: string;
    total: number;
    items: SignalListItem[];
    data: SignalListItem[];
}

export default function MapScreen() {
    const router = useRouter();
    const [agencyModalVisible, setAgencyModalVisible] = useState(false);
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [libraryModalVisible, setLibraryModalVisible] = useState(true);
    const [signalItems, setSignalItems] = useState<SignalListItem[]>([]);
    const [signalFilter, setSignalFilter] = useState('');
    const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
    const [signalPendingDeletion, setSignalPendingDeletion] = useState<SignalListItem | null>(null);
    const [deletingSignal, setDeletingSignal] = useState(false);
    const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
    const [collapsedAgencies, setCollapsedAgencies] = useState<ReadonlySet<string>>(new Set());
    const listRef = useRef<SectionList<SignalListItem, AgencySection>>(null);

    // On web, reveal the Edit button on row hover via pure CSS (no JS state, so no
    // re-render / unmount flash). RN-Web compiles style opacity:0 to a stable atomic
    // class (.r-opacity-orgf3d); we force it to 1 when the hovered row (.group) is
    // hovered. Inject the rule once.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const styleId = 'signal-row-hover-style';
        if (!document.getElementById(styleId)) {
            const tag = document.createElement('style');
            tag.id = styleId;
            // Reveal any opacity-0 descendant of a hovered .group row.
            tag.textContent = '.group:hover .r-opacity-orgf3d{opacity:1 !important;}';
            document.head.appendChild(tag);
        }
    }

    // All saved GTSS signals, ordered by agency and then signal id.
    const refreshSignals = useCallback(async () => {
        const feeds = await listAllFeeds();
        const items: SignalListItem[] = feeds
            .filter(
                (feed) =>
                    feed.signal &&
                    Number.isFinite(feed.signal.latitude) &&
                    Number.isFinite(feed.signal.longitude)
            )
            .map((feed) => ({
                signalId: feed.signalId,
                agencyName: feed.agency.agencyName || feed.agency.agencyId,
                streetName1: feed.signal.streetName1,
                streetName2: feed.signal.streetName2,
                latitude: feed.signal.latitude,
                longitude: feed.signal.longitude,
            }));
        items.sort(
            (a, b) =>
                a.agencyName.localeCompare(b.agencyName) ||
                a.signalId.localeCompare(b.signalId, undefined, { numeric: true })
        );
        setSignalItems(items);
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshSignals();
        }, [refreshSignals])
    );

    const filteredSignalItems = useMemo(() => {
        const filter = signalFilter.trim().toLocaleLowerCase();
        if (!filter) return signalItems;
        return signalItems.filter((item) =>
            [item.signalId, item.streetName1, item.streetName2]
                .some((value) => value.toLocaleLowerCase().includes(filter))
        );
    }, [signalFilter, signalItems]);

    // signalItems is already sorted by agency then id, so sections keep that order.
    // (globalThis.Map: the local `Map` identifier is the map component import.)
    const sections = useMemo<AgencySection[]>(() => {
        const byAgency = new globalThis.Map<string, SignalListItem[]>();
        for (const item of filteredSignalItems) {
            const group = byAgency.get(item.agencyName);
            if (group) {
                group.push(item);
            } else {
                byAgency.set(item.agencyName, [item]);
            }
        }
        return [...byAgency.entries()].map(([agencyName, items]) => ({
            agencyName,
            total: items.length,
            items,
            data: collapsedAgencies.has(agencyName) ? [] : items,
        }));
    }, [filteredSignalItems, collapsedAgencies]);

    const setAgencyCollapsed = useCallback((agencyName: string, collapsed: boolean) => {
        setCollapsedAgencies((prev) => {
            if (prev.has(agencyName) === collapsed) return prev;
            const next = new Set(prev);
            if (collapsed) {
                next.add(agencyName);
            } else {
                next.delete(agencyName);
            }
            return next;
        });
    }, []);

    function handleSelectIntersection(node: TrafficSignalNode) {
        router.push({
            pathname: '/intersection/[id]',
            params: { id: node.id, lat: String(node.latitude), lon: String(node.longitude) },
        });
    }

    function handleEditSignal(item: SignalListItem) {
        router.push({
            pathname: '/intersection/[id]',
            params: { id: item.signalId, lat: String(item.latitude), lon: String(item.longitude) },
        });
    }

    async function handleDeleteSignal() {
        if (!signalPendingDeletion) return;
        setDeletingSignal(true);
        try {
            await deleteFeed(signalPendingDeletion.signalId);
            if (selectedSignalId === signalPendingDeletion.signalId) {
                setSelectedSignalId(null);
                setFocusTarget(null);
            }
            setSignalPendingDeletion(null);
            await refreshSignals();
        } finally {
            setDeletingSignal(false);
        }
    }

    // Tapping a list row: highlight the pin and zoom the map to it.
    function handleSelectFromList(item: SignalListItem) {
        setSelectedSignalId(item.signalId);
        setFocusTarget({ latitude: item.latitude, longitude: item.longitude, nonce: Date.now() });
    }

    // Tapping a pin: highlight the matching row, expand its agency, and scroll it into view.
    // Tapping the already-selected (orange) pin opens the edit intersection page.
    function handleSelectFromPin(signalId: string) {
        if (signalId === selectedSignalId) {
            const item = signalItems.find((entry) => entry.signalId === signalId);
            if (item) {
                handleEditSignal(item);
            }
            return;
        }
        setSelectedSignalId(signalId);
        const sectionIndex = sections.findIndex((section) =>
            section.items.some((item) => item.signalId === signalId)
        );
        if (sectionIndex < 0) return;
        const section = sections[sectionIndex];
        const scrollToRow = () => {
            const itemIndex = section.items.findIndex((item) => item.signalId === signalId);
            if (itemIndex < 0) return;
            try {
                listRef.current?.scrollToLocation({
                    sectionIndex,
                    itemIndex,
                    viewPosition: 0.5,
                    animated: true,
                });
            } catch {
                setTimeout(scrollToRow, 250);
            }
        };
        if (collapsedAgencies.has(section.agencyName)) {
            setAgencyCollapsed(section.agencyName, false);
            // Wait for the expanded rows to render before scrolling.
            setTimeout(scrollToRow, 150);
        } else {
            scrollToRow();
        }
    }

    return (
        <>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <Pressable onPress={() => setLibraryModalVisible(true)} hitSlop={8}>
                                <Text style={{ color: '#2c3e50', fontWeight: '600' }}>Load GTSS</Text>
                            </Pressable>
                            <Pressable onPress={() => setExportModalVisible(true)} hitSlop={8}>
                                <Text style={{ color: '#2c3e50', fontWeight: '600' }}>Export GTSS</Text>
                            </Pressable>
                            <Pressable onPress={() => setAgencyModalVisible(true)} hitSlop={8}>
                                <Text style={{ paddingRight: 10, color: '#2c3e50', fontWeight: '600' }}>Configure Agencies</Text>
                            </Pressable>
                        </View>
                    ),
                }}
            />
            <View style={styles.mapArea}>
                <Map
                    onSelectIntersection={handleSelectIntersection}
                    gtssSignals={signalItems}
                    selectedSignalId={selectedSignalId}
                    focusTarget={focusTarget}
                    onSelectGtssSignal={handleSelectFromPin}
                />
                {signalItems.length > 0 ? (
                    <View style={styles.signalPanel}>
                        <Text style={styles.panelTitle}>Signals ({signalItems.length})</Text>
                        <TextInput
                            style={styles.signalFilter}
                            value={signalFilter}
                            onChangeText={setSignalFilter}
                            placeholder="Filter by ID or street name"
                            placeholderTextColor="#777"
                            autoCapitalize="none"
                            autoCorrect={false}
                            clearButtonMode="while-editing"
                        />
                        <SectionList<SignalListItem, AgencySection>
                            ref={listRef}
                            style={styles.signalList}
                            sections={sections}
                            keyExtractor={(item) => item.signalId}
                            extraData={selectedSignalId}
                            stickySectionHeadersEnabled={false}
                            renderSectionHeader={({ section }) => {
                                const collapsed = collapsedAgencies.has(section.agencyName);
                                return (
                                    <Pressable
                                        style={styles.agencyHeader}
                                        onPress={() => setAgencyCollapsed(section.agencyName, !collapsed)}
                                    >
                                        <Text style={styles.agencyChevron}>{collapsed ? '▸' : '▾'}</Text>
                                        <Text style={styles.agencyName} numberOfLines={1}>
                                            {section.agencyName}
                                        </Text>
                                        <Text style={styles.agencyCount}>{section.total}</Text>
                                    </Pressable>
                                );
                            }}
                            renderItem={({ item }) => {
                                const selected = item.signalId === selectedSignalId;
                                const streets = [item.streetName1, item.streetName2].filter(Boolean).join(' & ');
                                const inner = (
                                    <>
                                        <View style={styles.signalRowText}>
                                            <Text style={[styles.signalId, selected && styles.signalIdSelected]}>
                                                {item.signalId}
                                            </Text>
                                            {streets ? (
                                                <Text style={styles.signalStreets} numberOfLines={1}>
                                                    {streets}
                                                </Text>
                                            ) : null}
                                        </View>
                                        {/* Selected rows always show Edit; otherwise revealed on row
                                            hover via CSS (.group:hover). Always mounted and always
                                            clickable so it never unmounts mid-click. */}
                                        <Pressable
                                            style={[styles.editButton, !selected && styles.editButtonHidden]}
                                            hitSlop={8}
                                            onPress={(event) => {
                                                event.stopPropagation();
                                                handleEditSignal(item);
                                            }}
                                        >
                                            <Ionicons name="create-outline" size={17} color="#fff" />
                                        </Pressable>
                                        <Pressable
                                            style={[styles.deleteButton, !selected && styles.editButtonHidden]}
                                            hitSlop={8}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Delete signal ${item.signalId}`}
                                            onPress={(event) => {
                                                event.stopPropagation();
                                                setSignalPendingDeletion(item);
                                            }}
                                        >
                                            <Ionicons name="trash-outline" size={17} color="#fff" />
                                        </Pressable>
                                    </>
                                );
                                return (
                                    <Pressable
                                        style={[styles.signalRow, selected && styles.signalRowSelected]}
                                        onPress={() => handleSelectFromList(item)}
                                    >
                                        {Platform.OS === 'web' ? (
                                            <div className="group" style={webRowContentStyle}>
                                                {inner}
                                            </div>
                                        ) : (
                                            <View style={styles.signalRowContent}>{inner}</View>
                                        )}
                                    </Pressable>
                                );
                            }}
                        />
                    </View>
                ) : null}
            </View>
            <AgencyModal
                visible={agencyModalVisible}
                onClose={() => {
                    setAgencyModalVisible(false);
                    refreshSignals();
                }}
            />
            <ExportModal visible={exportModalVisible} onClose={() => setExportModalVisible(false)} />
            <LibraryModal
                visible={libraryModalVisible}
                onClose={() => {
                    setLibraryModalVisible(false);
                    refreshSignals();
                }}
            />
            <Modal
                visible={signalPendingDeletion !== null}
                animationType="fade"
                transparent
                onRequestClose={() => !deletingSignal && setSignalPendingDeletion(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.deleteModal}>
                        <Text style={styles.deleteModalTitle}>Delete signal?</Text>
                        <Text style={styles.deleteModalText}>
                            Delete signal {signalPendingDeletion?.signalId}? This cannot be undone.
                        </Text>
                        <View style={styles.deleteModalActions}>
                            <Pressable
                                style={styles.cancelDeleteButton}
                                onPress={() => setSignalPendingDeletion(null)}
                                disabled={deletingSignal}
                            >
                                <Text style={styles.cancelDeleteButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.confirmDeleteButton, deletingSignal && styles.confirmDeleteButtonDisabled]}
                                onPress={handleDeleteSignal}
                                disabled={deletingSignal}
                            >
                                <Text style={styles.confirmDeleteButtonText}>
                                    {deletingSignal ? 'Deleting...' : 'Delete'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    mapArea: { flex: 1 },
    signalPanel: {
        position: 'absolute',
        top: 12,
        left: 12,
        width: 260,
        maxHeight: '60%',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderRadius: 12,
        padding: 10,
        zIndex: 2000,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 6,
    },
    panelTitle: { fontSize: 14, fontWeight: '700', color: '#2c3e50', marginBottom: 6 },
    signalFilter: {
        height: 36,
        borderWidth: 1,
        borderColor: '#c7d0d9',
        borderRadius: 6,
        paddingHorizontal: 9,
        marginBottom: 6,
        color: '#222',
        fontSize: 13,
        backgroundColor: '#fff',
    },
    signalList: { flexGrow: 0 },
    agencyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(44, 62, 80, 0.08)',
        borderRadius: 8,
        marginTop: 2,
    },
    agencyChevron: { width: 14, fontSize: 12, color: '#666' },
    agencyName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#2c3e50' },
    agencyCount: { fontSize: 12, color: '#888' },
    signalRow: {
        paddingVertical: 8,
        paddingRight: 8,
        paddingLeft: 24,
        borderRadius: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    signalRowSelected: { backgroundColor: '#d8f0e0' },
    signalRowContent: { flexDirection: 'row', alignItems: 'center' },
    signalRowText: { flex: 1, paddingRight: 8 },
    signalId: { fontSize: 14, fontWeight: '600', color: '#222' },
    signalIdSelected: { color: '#1b8a3e' },
    signalStreets: { fontSize: 12, color: '#555', marginTop: 1 },
    editButton: {
        width: 30,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        backgroundColor: '#e67e22',
    },
    editButtonHidden: { opacity: 0 },
    deleteButton: {
        width: 30,
        height: 28,
        marginLeft: 5,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        backgroundColor: '#c0392b',
    },
    modalBackdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    deleteModal: {
        width: '100%',
        maxWidth: 360,
        padding: 20,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    deleteModalTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
    deleteModalText: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#555' },
    deleteModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
    cancelDeleteButton: { paddingVertical: 9, paddingHorizontal: 13 },
    cancelDeleteButtonText: { color: '#2c3e50', fontWeight: '600', fontSize: 14 },
    confirmDeleteButton: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 6, backgroundColor: '#c0392b' },
    confirmDeleteButtonDisabled: { backgroundColor: '#d99a94' },
    confirmDeleteButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// Flexbox row layout for the web hover wrapper div (mirrors signalRowContent).
const webRowContentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
};
