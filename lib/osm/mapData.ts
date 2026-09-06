// Fetches local map geometry (roads + buildings) from Overpass for the 3D view.

export interface OsmPoint {
    lat: number;
    lon: number;
}

export interface OsmRoad {
    id: string;
    name: string | null;
    highway: string;
    lanes: number | null;
    width: number | null;
    points: OsmPoint[];
}

export interface OsmBuilding {
    id: string;
    levels: number | null;
    height: number | null;
    points: OsmPoint[];
}

export interface IntersectionMapData {
    roads: OsmRoad[];
    buildings: OsmBuilding[];
}

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// Width in meters assumed for a single lane when OSM lacks explicit data.
const LANE_WIDTH_M = 3.2;

// Approximate carriageway width in meters for each highway class when neither
// lanes nor width are tagged.
const HIGHWAY_WIDTHS: Record<string, number> = {
    motorway: 14,
    trunk: 12,
    primary: 10,
    secondary: 9,
    tertiary: 8,
    unclassified: 6.5,
    residential: 6.5,
    service: 4.5,
    living_street: 5,
    pedestrian: 4,
    footway: 2,
    path: 1.5,
    cycleway: 2,
    track: 3,
};

export function roadWidthMeters(road: Pick<OsmRoad, 'highway' | 'lanes' | 'width'>): number {
    if (road.width != null && road.width > 0) return road.width;
    if (road.lanes != null && road.lanes > 0) return road.lanes * LANE_WIDTH_M;
    return HIGHWAY_WIDTHS[road.highway] ?? 6;
}

// Roads/buildings within `radiusMeters` of the given coordinate, returned as
// polylines/polygons with full node geometry.
export async function fetchIntersectionMapData(
    latitude: number,
    longitude: number,
    radiusMeters = 120,
    signal?: AbortSignal
): Promise<IntersectionMapData> {
    const around = `around:${Math.round(radiusMeters)},${latitude},${longitude}`;
    const query = `[out:json][timeout:25];(
  way["highway"](${around});
  way["building"](${around});
);out geom;`;

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
    const elements: {
        type: string;
        id: number;
        tags?: Record<string, string>;
        geometry?: { lat: number; lon: number }[];
    }[] = data.elements ?? [];

    const roads: OsmRoad[] = [];
    const buildings: OsmBuilding[] = [];

    for (const el of elements) {
        if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
        const tags = el.tags ?? {};
        const points = el.geometry.map((p) => ({ lat: p.lat, lon: p.lon }));

        if (tags.highway) {
            roads.push({
                id: String(el.id),
                name: tags.name ?? null,
                highway: tags.highway,
                lanes: parseCount(tags.lanes),
                width: parseCount(tags['width']),
                points,
            });
        } else if (tags.building) {
            buildings.push({
                id: String(el.id),
                levels: parseCount(tags['building:levels']),
                height: parseCount(tags['height']),
                points,
            });
        }
    }

    return { roads, buildings };
}

function parseCount(value: string | undefined): number | null {
    if (!value) return null;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}
