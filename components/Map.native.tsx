import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { fetchTrafficSignals, type MapBounds, type TrafficSignalNode } from '@/lib/osm/overpass';

function regionToBounds(region: Region): MapBounds {
  return {
    north: region.latitude + region.latitudeDelta / 2,
    south: region.latitude - region.latitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
  };
}

export interface MapProps {
  onSelectIntersection: (node: TrafficSignalNode) => void;
}

export default function Map({ onSelectIntersection }: MapProps) {
  const [signals, setSignals] = useState<TrafficSignalNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchTrafficSignals(regionToBounds(region), controller.signal)
      .then((nodes) => {
        setSignals(nodes);
        setError(null);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError('Could not load intersections. Pan or zoom to retry.');
      });
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 40.712776,
          longitude: -74.005974,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {signals.map((node) => (
          <Marker
            key={node.id}
            coordinate={{ latitude: node.latitude, longitude: node.longitude }}
            onPress={() => onSelectIntersection(node)}
          />
        ))}
      </MapView>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  errorBanner: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: '#b00020',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  errorText: { color: '#fff' },
});
