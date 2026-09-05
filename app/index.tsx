import { useRouter } from 'expo-router';

import Map from '@/components/Map';
import type { TrafficSignalNode } from '@/lib/osm/overpass';

export default function MapScreen() {
    const router = useRouter();

    function handleSelectIntersection(node: TrafficSignalNode) {
        router.push({
            pathname: '/intersection/[id]',
            params: { id: node.id, lat: String(node.latitude), lon: String(node.longitude) },
        });
    }

    return <Map onSelectIntersection={handleSelectIntersection} />;
}
