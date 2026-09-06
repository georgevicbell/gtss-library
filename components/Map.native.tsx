import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface GtssSignalPin {
    signalId: string;
    latitude: number;
    longitude: number;
}

export interface MapFocusTarget {
    latitude: number;
    longitude: number;
    // Bump this to re-focus the same location (e.g. tapping the same list row twice).
    nonce: number;
}

export interface MapBoundsTarget {
    bounds: MapBounds;
    // Bump this to re-fit the bounds.
    nonce: number;
}

export interface MapProps {
    onSelectIntersection: (node: TrafficSignalNode) => void;
    gtssSignals?: GtssSignalPin[];
    selectedSignalId?: string | null;
    focusTarget?: MapFocusTarget | null;
    boundsTarget?: MapBoundsTarget | null;
    onSelectGtssSignal?: (signalId: string) => void;
}

export default function Map({
    onSelectIntersection,
    gtssSignals = [],
    selectedSignalId = null,
    focusTarget = null,
    boundsTarget = null,
    onSelectGtssSignal,
}: MapProps) {
    const [signals, setSignals] = useState<TrafficSignalNode[]>([]);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const mapRef = useRef<MapView | null>(null);

    // Zoom to the signal tapped in the list.
    useEffect(() => {
        if (!focusTarget) return;
        mapRef.current?.animateToRegion(
            {
                latitude: focusTarget.latitude,
                longitude: focusTarget.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            },
            600
        );
    }, [focusTarget]);

    // Fit to bounds when boundsTarget changes.
    useEffect(() => {
        if (!boundsTarget) return;
        const south = Math.min(boundsTarget.bounds.south, boundsTarget.bounds.north);
        const north = Math.max(boundsTarget.bounds.south, boundsTarget.bounds.north);
        const west = Math.min(boundsTarget.bounds.west, boundsTarget.bounds.east);
        const east = Math.max(boundsTarget.bounds.west, boundsTarget.bounds.east);

        if (south === north && west === east) {
            mapRef.current?.animateToRegion(
                {
                    latitude: north,
                    longitude: east,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                },
                600
            );
        } else {
            mapRef.current?.fitToCoordinates(
                [
                    { latitude: south, longitude: west },
                    { latitude: north, longitude: east },
                ],
                {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                }
            );
        }
    }, [boundsTarget]);

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
                ref={mapRef}
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
                {gtssSignals.map((signal) => {
                    const selected = signal.signalId === selectedSignalId;
                    return (
                        <Marker
                            key={`gtss-${signal.signalId}`}
                            coordinate={{ latitude: signal.latitude, longitude: signal.longitude }}
                            pinColor={selected ? '#e67e22' : '#1b8a3e'}
                            zIndex={selected ? 2 : 1}
                            onPress={() => onSelectGtssSignal?.(signal.signalId)}
                        />
                    );
                })}
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
