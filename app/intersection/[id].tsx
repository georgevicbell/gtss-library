import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import EntityListEditor, { type Column } from '@/components/gtss/EntityListEditor';
import PhaseDiagram from '@/components/gtss/PhaseDiagram';
import { exportGtssZip } from '@/lib/gtss/export';
import { loadOrCreateFeed, saveFeed } from '@/lib/gtss/storage';
import {
    FREE_RIGHT_VALUES,
    MOVEMENT_TYPES,
    PEDESTRIAN_MODES,
    VEH_RECALL_TYPES,
    type Approach,
    type BasicTiming,
    type Detector,
    type GtssFeed,
    type Phase,
} from '@/lib/gtss/types';

function nextNumericId<T>(rows: T[], key: keyof T): number {
    return rows.reduce((acc, row) => Math.max(acc, Number(row[key]) || 0), 0) + 1;
}

function nextChannelId(rows: Detector[]): string {
    return String(rows.reduce((acc, row) => Math.max(acc, Number(row.channel) || 0), 0) + 1);
}

export default function IntersectionScreen() {
    const { id, lat, lon } = useLocalSearchParams<{ id: string; lat?: string; lon?: string }>();
    const [feed, setFeed] = useState<GtssFeed | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadOrCreateFeed(id, Number(lat) || 0, Number(lon) || 0).then((loaded) => {
            if (!cancelled) setFeed(loaded);
        });
        return () => {
            cancelled = true;
        };
    }, [id, lat, lon]);

    useEffect(() => {
        if (feed) saveFeed(feed);
    }, [feed]);

    if (!feed) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator />
            </View>
        );
    }

    async function handleExport() {
        if (!feed) return;
        setExporting(true);
        try {
            await exportGtssZip(feed);
        } finally {
            setExporting(false);
        }
    }

    const approachColumns: Column<Approach>[] = [
        { key: 'streetName', label: 'Street name', type: 'text' },
        { key: 'compassBearing', label: 'Compass bearing (0-360)', type: 'number' },
        { key: 'postedSpeed', label: 'Posted speed (mph)', type: 'number' },
        { key: 'freeRight', label: 'Free right (0=none,1=FR,2=FR-P,3=FR-P-I)', type: 'select', options: FREE_RIGHT_VALUES },
        { key: 'freeRightLanes', label: 'Free right lanes', type: 'number' },
    ];

    const phaseColumns: Column<Phase>[] = [
        { key: 'approachId', label: 'Approach ID', type: 'text' },
        { key: 'movementType', label: 'Movement type', type: 'select', options: MOVEMENT_TYPES },
        { key: 'numOfLanes', label: 'Number of lanes', type: 'number' },
        { key: 'isPedestrian', label: 'Pedestrian mode (0-7)', type: 'select', options: PEDESTRIAN_MODES },
        { key: 'crosswalkLength', label: 'Measured crosswalk length (ft, optional)', type: 'number' },
    ];

    const detectorColumns: Column<Detector>[] = [
        { key: 'phase', label: 'Phase', type: 'number' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'purpose', label: 'Purpose', type: 'select', options: ['stop bar', 'advanced', 'count'] },
        { key: 'vehicleType', label: 'Vehicle type', type: 'select', options: ['car', 'truck', 'bus', 'bicycle', 'pedestrian'] },
        { key: 'lane', label: 'Lane', type: 'text' },
        {
            key: 'technologyType',
            label: 'Technology',
            type: 'select',
            options: ['inductive_loop', 'radar', 'microwave', 'lidar', 'magnetometer', 'hybrid', 'video'],
        },
        { key: 'length', label: 'Length (ft)', type: 'number' },
        { key: 'stopbarSetbackDist', label: 'Stopbar setback (ft)', type: 'number' },
    ];

    const basicTimingColumns: Column<BasicTiming>[] = [
        { key: 'phase', label: 'Phase', type: 'number' },
        { key: 'pedWalk', label: 'Ped walk (s)', type: 'number' },
        { key: 'pedClearance', label: 'Ped clearance (s)', type: 'number' },
        { key: 'leadingPedInterval', label: 'Leading ped interval (s)', type: 'number' },
        { key: 'minGreen', label: 'Min green (s)', type: 'number' },
        { key: 'maxGreen', label: 'Max green (s)', type: 'number' },
        { key: 'yellow', label: 'Yellow (s)', type: 'number' },
        { key: 'allRed', label: 'All red (s)', type: 'number' },
        { key: 'vehRecallType', label: 'Vehicle recall type', type: 'select', options: VEH_RECALL_TYPES },
        { key: 'pedRecall', label: 'Ped recall', type: 'boolean' },
    ];

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.heading}>Signal {feed.signalId}</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Diagram</Text>
                <View style={styles.diagramCard}>
                    <PhaseDiagram
                        phases={feed.phases}
                        approaches={feed.approaches}
                        intersectionId={feed.signalId}
                        intersectionName={[feed.signal.streetName1, feed.signal.streetName2].filter(Boolean).join(' & ')}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Agency</Text>
                <View style={styles.card}>
                    <Text style={styles.fieldLabel}>Agency name</Text>
                    <TextInput
                        style={styles.input}
                        value={feed.agency.agencyName}
                        onChangeText={(text) =>
                            setFeed({ ...feed, agency: { ...feed.agency, agencyName: text } })
                        }
                    />
                    <Text style={styles.fieldLabel}>Agency URL</Text>
                    <TextInput
                        style={styles.input}
                        value={feed.agency.agencyUrl ?? ''}
                        onChangeText={(text) => setFeed({ ...feed, agency: { ...feed.agency, agencyUrl: text } })}
                    />
                    <Text style={styles.fieldLabel}>Timezone (IANA)</Text>
                    <TextInput
                        style={styles.input}
                        value={feed.agency.agencyTimezone}
                        onChangeText={(text) =>
                            setFeed({ ...feed, agency: { ...feed.agency, agencyTimezone: text } })
                        }
                    />
                    <Text style={styles.fieldLabel}>Contact email</Text>
                    <TextInput
                        style={styles.input}
                        value={feed.agency.agencyEmail ?? ''}
                        onChangeText={(text) =>
                            setFeed({ ...feed, agency: { ...feed.agency, agencyEmail: text } })
                        }
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Signal</Text>
                <View style={styles.card}>
                    <Text style={styles.fieldLabel}>Street name 1</Text>
                    <TextInput
                        style={styles.input}
                        value={feed.signal.streetName1}
                        onChangeText={(text) =>
                            setFeed({ ...feed, signal: { ...feed.signal, streetName1: text } })
                        }
                    />
                    <Text style={styles.fieldLabel}>Street name 2</Text>
                    <TextInput
                        style={styles.input}
                        value={feed.signal.streetName2}
                        onChangeText={(text) =>
                            setFeed({ ...feed, signal: { ...feed.signal, streetName2: text } })
                        }
                    />
                    <Text style={styles.fieldLabel}>Latitude</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(feed.signal.latitude)}
                        onChangeText={(text) =>
                            setFeed({ ...feed, signal: { ...feed.signal, latitude: Number(text) || 0 } })
                        }
                    />
                    <Text style={styles.fieldLabel}>Longitude</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(feed.signal.longitude)}
                        onChangeText={(text) =>
                            setFeed({ ...feed, signal: { ...feed.signal, longitude: Number(text) || 0 } })
                        }
                    />
                </View>
            </View>

            <EntityListEditor<Approach>
                title="Approaches"
                rows={feed.approaches}
                columns={approachColumns}
                createRow={() => ({
                    approachId: String(nextNumericId(feed.approaches, 'approachId')),
                    signalId: feed.signalId,
                    streetName: '',
                    compassBearing: 0,
                    postedSpeed: 25,
                    freeRight: 0,
                    freeRightLanes: 1,
                })}
                onChange={(approaches) => setFeed({ ...feed, approaches })}
            />

            <EntityListEditor<Phase>
                title="Phases"
                rows={feed.phases}
                columns={phaseColumns}
                createRow={() => ({
                    phase: nextNumericId(feed.phases, 'phase'),
                    approachId: feed.approaches[0]?.approachId ?? null,
                    signalId: feed.signalId,
                    movementType: 'Through',
                    numOfLanes: 1,
                    isPedestrian: 0,
                    crosswalkLength: null,
                })}
                onChange={(phases) => setFeed({ ...feed, phases })}
            />

            <EntityListEditor<Detector>
                title="Detectors"
                rows={feed.detectors}
                columns={detectorColumns}
                createRow={() => ({
                    channel: nextChannelId(feed.detectors),
                    signalId: feed.signalId,
                    phase: feed.phases[0]?.phase ?? 1,
                    description: '',
                    purpose: 'stop bar',
                    vehicleType: 'car',
                    lane: '1',
                    technologyType: 'inductive_loop',
                    length: 6,
                    stopbarSetbackDist: 0,
                })}
                onChange={(detectors) => setFeed({ ...feed, detectors })}
            />

            <EntityListEditor<BasicTiming>
                title="Basic timings"
                rows={feed.basicTimings}
                columns={basicTimingColumns}
                createRow={() => ({
                    phase: feed.phases[0]?.phase ?? 1,
                    signalId: feed.signalId,
                    pedWalk: 7,
                    pedClearance: 20,
                    leadingPedInterval: 0,
                    minGreen: 8,
                    maxGreen: 40,
                    yellow: 4,
                    allRed: 2,
                    vehRecallType: 'None',
                    pedRecall: false,
                })}
                onChange={(basicTimings) => setFeed({ ...feed, basicTimings })}
            />

            <Pressable style={styles.exportButton} onPress={handleExport} disabled={exporting}>
                <Text style={styles.exportButtonText}>
                    {exporting ? 'Exporting…' : 'Export GTSS zip'}
                </Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 48 },
    heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fafafa',
    },
    diagramCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    fieldLabel: { fontSize: 12, color: '#555', marginBottom: 4, marginTop: 8 },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
    },
    exportButton: {
        backgroundColor: '#1b8a3e',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    exportButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
