import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import EntityListEditor, { type Column } from '@/components/gtss/EntityListEditor';
import { exportGtssZip } from '@/lib/gtss/export';
import { loadOrCreateFeed, saveFeed } from '@/lib/gtss/storage';
import {
  DETECTOR_MODES,
  DETECTOR_PURPOSES,
  DETECTOR_TECHNOLOGIES,
  DETECTOR_VEHICLE_TYPES,
  MOVEMENT_TYPES,
  PED_X_VALUES,
  VEH_RECALL_TYPES,
  type Approach,
  type BasicTiming,
  type Detector,
  type GtssFeed,
  type Phase,
} from '@/lib/gtss/types';

function nextId<T>(rows: T[], key: keyof T): string {
  const max = rows.reduce((acc, row) => Math.max(acc, Number(row[key]) || 0), 0);
  return String(max + 1);
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

  const signal = feed.signals[0];

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
    { key: 'street_name', label: 'Street name', type: 'text' },
    { key: 'compass_bearing', label: 'Compass bearing (0-360)', type: 'number' },
    { key: 'posted_speed', label: 'Posted speed (mph)', type: 'number' },
    { key: 'free_right', label: 'Free right', type: 'text' },
  ];

  const phaseColumns: Column<Phase>[] = [
    { key: 'approach_id', label: 'Approach ID', type: 'text' },
    { key: 'movement_type', label: 'Movement type', type: 'select', options: MOVEMENT_TYPES },
    { key: 'num_of_lanes', label: 'Number of lanes', type: 'number' },
    { key: 'pedX', label: 'PedX', type: 'select', options: PED_X_VALUES },
    { key: 'crosswalk_length', label: 'Crosswalk length', type: 'text' },
  ];

  const detectorColumns: Column<Detector>[] = [
    { key: 'phase', label: 'Phase', type: 'text' },
    { key: 'description', label: 'Description', type: 'text' },
    { key: 'purpose', label: 'Purpose', type: 'select', options: DETECTOR_PURPOSES },
    { key: 'vehicle_type', label: 'Vehicle type', type: 'select', options: DETECTOR_VEHICLE_TYPES },
    { key: 'lane', label: 'Lane', type: 'number' },
    { key: 'technology_type', label: 'Technology', type: 'select', options: DETECTOR_TECHNOLOGIES },
    { key: 'mode', label: 'Mode', type: 'select', options: DETECTOR_MODES },
    { key: 'length', label: 'Length (ft)', type: 'number' },
    { key: 'stopbar_setback_dist', label: 'Stopbar setback (ft)', type: 'number' },
  ];

  const basicTimingColumns: Column<BasicTiming>[] = [
    { key: 'phase', label: 'Phase', type: 'text' },
    { key: 'ped_walk', label: 'Ped walk (s)', type: 'number' },
    { key: 'ped_clearance', label: 'Ped clearance (s)', type: 'number' },
    { key: 'leading_ped_interval', label: 'Leading ped interval (s)', type: 'number' },
    { key: 'min_green', label: 'Min green (s)', type: 'number' },
    { key: 'max_green', label: 'Max green (s)', type: 'number' },
    { key: 'yellow', label: 'Yellow (s)', type: 'number' },
    { key: 'all_red', label: 'All red (s)', type: 'number' },
    { key: 'veh_recall_type', label: 'Vehicle recall type', type: 'select', options: VEH_RECALL_TYPES },
    { key: 'ped_recall', label: 'Ped recall', type: 'boolean' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Signal {feed.signalId}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agency</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Agency name</Text>
          <TextInput
            style={styles.input}
            value={feed.agency.agency_name}
            onChangeText={(text) =>
              setFeed({ ...feed, agency: { ...feed.agency, agency_name: text } })
            }
          />
          <Text style={styles.fieldLabel}>Agency URL</Text>
          <TextInput
            style={styles.input}
            value={feed.agency.agency_url}
            onChangeText={(text) => setFeed({ ...feed, agency: { ...feed.agency, agency_url: text } })}
          />
          <Text style={styles.fieldLabel}>Timezone (IANA)</Text>
          <TextInput
            style={styles.input}
            value={feed.agency.agency_timezone}
            onChangeText={(text) =>
              setFeed({ ...feed, agency: { ...feed.agency, agency_timezone: text } })
            }
          />
          <Text style={styles.fieldLabel}>Contact email</Text>
          <TextInput
            style={styles.input}
            value={feed.agency.agency_email}
            onChangeText={(text) =>
              setFeed({ ...feed, agency: { ...feed.agency, agency_email: text } })
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Signal</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Latitude</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(signal.latitude)}
            onChangeText={(text) =>
              setFeed({
                ...feed,
                signals: [{ ...signal, latitude: Number(text) || 0 }],
              })
            }
          />
          <Text style={styles.fieldLabel}>Longitude</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(signal.longitude)}
            onChangeText={(text) =>
              setFeed({
                ...feed,
                signals: [{ ...signal, longitude: Number(text) || 0 }],
              })
            }
          />
        </View>
      </View>

      <EntityListEditor<Approach>
        title="Approaches"
        rows={feed.approaches}
        columns={approachColumns}
        createRow={() => ({
          approach_id: nextId(feed.approaches, 'approach_id'),
          signal_id: feed.signalId,
          street_name: '',
          compass_bearing: 0,
          posted_speed: 25,
          free_right: '0',
        })}
        onChange={(approaches) => setFeed({ ...feed, approaches })}
      />

      <EntityListEditor<Phase>
        title="Phases"
        rows={feed.phases}
        columns={phaseColumns}
        createRow={() => ({
          phase: nextId(feed.phases, 'phase'),
          approach_id: feed.approaches[0]?.approach_id ?? '',
          signal_id: feed.signalId,
          movement_type: 'T',
          num_of_lanes: 1,
          pedX: 0,
          crosswalk_length: '',
        })}
        onChange={(phases) => setFeed({ ...feed, phases })}
      />

      <EntityListEditor<Detector>
        title="Detectors"
        rows={feed.detectors}
        columns={detectorColumns}
        createRow={() => ({
          channel: nextId(feed.detectors, 'channel'),
          signal_id: feed.signalId,
          phase: feed.phases[0]?.phase ?? '',
          description: '',
          purpose: 'stop bar',
          vehicle_type: 'car',
          lane: 1,
          technology_type: 'inductive_loop',
          mode: 'pulse',
          length: 6,
          stopbar_setback_dist: 0,
        })}
        onChange={(detectors) => setFeed({ ...feed, detectors })}
      />

      <EntityListEditor<BasicTiming>
        title="Basic timings"
        rows={feed.basicTimings}
        columns={basicTimingColumns}
        createRow={() => ({
          phase: feed.phases[0]?.phase ?? '',
          signal_id: feed.signalId,
          ped_walk: 7,
          ped_clearance: 20,
          leading_ped_interval: 0,
          min_green: 8,
          max_green: 40,
          yellow: 4,
          all_red: 2,
          veh_recall_type: 'None',
          ped_recall: false,
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
