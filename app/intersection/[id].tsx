import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import AgencyPicker from '@/components/gtss/AgencyPicker';
import EntityListEditor, { type Column } from '@/components/gtss/EntityListEditor';
import Intersection3D from '@/components/gtss/Intersection3D';
import PhaseDiagram from '@/components/gtss/PhaseDiagram';
import SignalMap from '@/components/gtss/SignalMap';
import Tabs from '@/components/gtss/Tabs';
import { listAgencies } from '@/lib/gtss/agencyStore';
import { loadOrCreateFeed, saveFeed } from '@/lib/gtss/storage';
import {
    FREE_RIGHT_VALUES,
    MOVEMENT_TYPES,
    PEDESTRIAN_MODES,
    VEH_RECALL_TYPES,
    type Agency,
    type Approach,
    type BasicTiming,
    type Detector,
    type GtssFeed,
    type Phase,
} from '@/lib/gtss/types';

type TabKey = 'approaches' | 'phases' | 'detectors' | 'timings';
type ViewKey = 'map' | '3d';

function nextNumericId<T>(rows: T[], key: keyof T): number {
    return rows.reduce((acc, row) => Math.max(acc, Number(row[key]) || 0), 0) + 1;
}

function nextChannelId(rows: Detector[]): string {
    return String(rows.reduce((acc, row) => Math.max(acc, Number(row.channel) || 0), 0) + 1);
}

export default function IntersectionScreen() {
    const { id, lat, lon } = useLocalSearchParams<{ id: string; lat?: string; lon?: string }>();
    const [feed, setFeed] = useState<GtssFeed | null>(null);
    const [agencies, setAgencies] = useState<Agency[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>('approaches');
    const [viewMode, setViewMode] = useState<ViewKey>('map');
    const { width } = useWindowDimensions();
    const isWide = width >= 900;

    useEffect(() => {
        let cancelled = false;
        loadOrCreateFeed(id, Number(lat) || 0, Number(lon) || 0).then((loaded) => {
            if (!cancelled) setFeed(loaded);
        });
        listAgencies().then((loaded) => {
            if (!cancelled) setAgencies(loaded);
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

    const signalInfoPanel = (
        <View style={[styles.card, styles.signalInfoCard]}>
            <Text style={styles.cardTitle}>Signal Info</Text>

            <Text style={styles.fieldLabel}>Signal ID</Text>
            <Text style={styles.readonlyValue}>{feed.signalId}</Text>

            <Text style={styles.fieldLabel}>Street name 1</Text>
            <TextInput
                style={styles.input}
                value={feed.signal.streetName1}
                onChangeText={(text) => setFeed({ ...feed, signal: { ...feed.signal, streetName1: text } })}
            />
            <Text style={styles.fieldLabel}>Street name 2</Text>
            <TextInput
                style={styles.input}
                value={feed.signal.streetName2}
                onChangeText={(text) => setFeed({ ...feed, signal: { ...feed.signal, streetName2: text } })}
            />
            <Text style={styles.fieldLabel}>Latitude</Text>
            <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(feed.signal.latitude)}
                onChangeText={(text) => setFeed({ ...feed, signal: { ...feed.signal, latitude: Number(text) || 0 } })}
            />
            <Text style={styles.fieldLabel}>Longitude</Text>
            <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(feed.signal.longitude)}
                onChangeText={(text) => setFeed({ ...feed, signal: { ...feed.signal, longitude: Number(text) || 0 } })}
            />

            <View style={styles.divider} />
            <Text style={styles.cardTitle}>Agency</Text>
            <AgencyPicker
                agencies={agencies}
                selectedAgencyId={feed.agency.agencyId}
                onSelect={(agency) =>
                    setFeed({ ...feed, agency, signal: { ...feed.signal, agencyId: agency.agencyId } })
                }
            />

            <View style={styles.divider} />
            <Text style={styles.cardTitle}>Counts</Text>
            <View style={styles.countRow}>
                <Text style={styles.countLabel}>Approaches</Text>
                <Text style={styles.countValue}>{feed.approaches.length}</Text>
            </View>
            <View style={styles.countRow}>
                <Text style={styles.countLabel}>Phases</Text>
                <Text style={styles.countValue}>{feed.phases.length}</Text>
            </View>
            <View style={styles.countRow}>
                <Text style={styles.countLabel}>Detectors</Text>
                <Text style={styles.countValue}>{feed.detectors.length}</Text>
            </View>
            <View style={styles.countRow}>
                <Text style={styles.countLabel}>Timings</Text>
                <Text style={styles.countValue}>{feed.basicTimings.length}</Text>
            </View>
        </View>
    );

    const mapPanel = (
        <View style={[styles.card, styles.mapCard]}>
            <Tabs<ViewKey>
                active={viewMode}
                onChange={setViewMode}
                options={[
                    { key: 'map', label: '2D Map' },
                    { key: '3d', label: '3D View' },
                ]}
            />
            <View style={styles.viewPane}>
                {viewMode === 'map' ? (
                    <SignalMap latitude={feed.signal.latitude} longitude={feed.signal.longitude} />
                ) : (
                    <Intersection3D feed={feed} />
                )}
            </View>
        </View>
    );

    const diagramPanel = (
        <View style={[styles.card, styles.diagramCard]}>
            <PhaseDiagram
                phases={feed.phases}
                approaches={feed.approaches}
                intersectionId={feed.signalId}
                intersectionName={[feed.signal.streetName1, feed.signal.streetName2].filter(Boolean).join(' & ')}
            />
        </View>
    );

    const tabsAndContent = (
        <>
            <Tabs<TabKey>
                active={activeTab}
                onChange={setActiveTab}
                options={[
                    { key: 'approaches', label: 'Approaches', count: feed.approaches.length },
                    { key: 'phases', label: 'Phases', count: feed.phases.length },
                    { key: 'detectors', label: 'Detection', count: feed.detectors.length },
                    { key: 'timings', label: 'Basic Timings', count: feed.basicTimings.length },
                ]}
            />

            {activeTab === 'approaches' && (
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
            )}

            {activeTab === 'phases' && (
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
            )}

            {activeTab === 'detectors' && (
                <EntityListEditor<Detector>
                    title="Detection"
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
            )}

            {activeTab === 'timings' && (
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
            )}
        </>
    );

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.heading}>Signal {feed.signalId}</Text>

            <View style={isWide ? styles.mainRowWide : undefined}>
                <View style={isWide ? styles.signalInfoColumnWide : undefined}>{signalInfoPanel}</View>

                <View style={isWide ? styles.mainColumnWide : undefined}>
                    <View style={[styles.topRow, isWide ? styles.topRowWide : styles.topRowNarrow]}>
                        <View style={isWide ? styles.mapColumnWide : styles.mapColumnNarrow}>{mapPanel}</View>
                        <View style={isWide ? styles.diagramColumnWide : undefined}>{diagramPanel}</View>
                    </View>

                    {tabsAndContent}
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 48 },
    heading: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
    mainRowWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    mainColumnWide: { flex: 1, minWidth: 0 },
    topRow: { marginBottom: 16, gap: 12 },
    topRowWide: { flexDirection: 'row', alignItems: 'flex-start' },
    topRowNarrow: { flexDirection: 'column' },
    signalInfoColumnWide: { width: 260 },
    mapColumnWide: { flex: 1, alignSelf: 'stretch', minWidth: 0 },

    mapColumnNarrow: { height: 200 },
    diagramColumnWide: { width: 340 },
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fafafa',
    },
    signalInfoCard: {},
    mapCard: { flex: 1, padding: 12, overflow: 'hidden', backgroundColor: '#fff' },
    viewPane: { flex: 1, minHeight: 320, borderRadius: 8, overflow: 'hidden' },
    diagramCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8, color: '#222' },
    divider: { borderTopWidth: 1, borderTopColor: '#ddd', marginVertical: 12 },
    countRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    countLabel: { fontSize: 12, color: '#555' },
    countValue: { fontSize: 12, fontWeight: '600', color: '#222' },
    readonlyValue: { fontSize: 14, fontFamily: 'monospace', marginBottom: 8 },
    fieldLabel: { fontSize: 12, color: '#555', marginBottom: 4, marginTop: 8 },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#fff',
    },
});
