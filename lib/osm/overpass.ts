export interface TrafficSignalNode {
  id: string;
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// Queries OSM for traffic-signal-controlled intersections within the given viewport.
export async function fetchTrafficSignals(
  bounds: MapBounds,
  signal?: AbortSignal
): Promise<TrafficSignalNode[]> {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  const query = `[out:json][timeout:25];node["highway"="traffic_signals"](${bbox});out body;`;

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed: ${response.status}`);
  }

  const data = await response.json();
  const elements: { id: number; lat: number; lon: number }[] = data.elements ?? [];

  return elements.map((el) => ({
    id: String(el.id),
    latitude: el.lat,
    longitude: el.lon,
  }));
}
