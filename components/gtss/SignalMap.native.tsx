import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export interface SignalMapProps {
  latitude: number;
  longitude: number;
}

// A small, static map centered on a single signal (no intersection browsing/fetching).
export default function SignalMap({ latitude, longitude }: SignalMapProps) {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={{ latitude, longitude, latitudeDelta: 0.003, longitudeDelta: 0.003 }}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <Marker coordinate={{ latitude, longitude }} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
