import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

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

function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom());
  }, [latitude, longitude, map]);
  return null;
}

export interface SignalMapProps {
  latitude: number;
  longitude: number;
}

// A small, static map centered on a single signal (no intersection browsing/fetching).
export default function SignalMap({ latitude, longitude }: SignalMapProps) {
  useLeafletCss();

  return (
    <View style={styles.container}>
      <MapContainer center={[latitude, longitude]} zoom={18} style={styles.map} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter latitude={latitude} longitude={longitude} />
        <Marker position={[latitude, longitude]} icon={signalIcon} />
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1, width: '100%', height: '100%' },
});
