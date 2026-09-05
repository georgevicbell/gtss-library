import L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { StyleSheet, Text, View } from 'react-native';

import { fetchTrafficSignals, type MapBounds, type TrafficSignalNode } from '@/lib/osm/overpass';

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

// Leaflet's default marker icons reference relative image paths that don't resolve
// under Metro's web bundler, so point them at a CDN instead.
const signalIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function useLeafletCss() {
    useEffect(() => {
        if (document.querySelector(`link[href="${LEAFLET_CSS_HREF}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS_HREF;
        document.head.appendChild(link);
    }, []);
}

function ViewportWatcher({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
    const map = useMapEvents({
        moveend: () => {
            const b = map.getBounds();
            onBoundsChange({
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest(),
            });
        },
    });

    useEffect(() => {
        const b = map.getBounds();
        onBoundsChange({
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest(),
        });
        // Only run once on mount to seed the initial viewport.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}

export interface MapProps {
    onSelectIntersection: (node: TrafficSignalNode) => void;
}

export default function Map({ onSelectIntersection }: MapProps) {
    useLeafletCss();
    const [signals, setSignals] = useState<TrafficSignalNode[]>([]);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const handleBoundsChange = useCallback((bounds: MapBounds) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        fetchTrafficSignals(bounds, controller.signal)
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
            <MapContainer
                center={[40.712776, -74.005974]}
                zoom={16}
                style={styles.map}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ViewportWatcher onBoundsChange={handleBoundsChange} />
                {signals.map((node) => (
                    <Marker
                        key={node.id}
                        position={[node.latitude, node.longitude]}
                        icon={signalIcon}
                        eventHandlers={{ click: () => onSelectIntersection(node) }}
                    />
                ))}
            </MapContainer>
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
    map: { flex: 1, width: '100%', height: '100%' },
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
