// Three.js scene builder for a single signalized intersection.
//
// Combines OSM map data (roads + extruded buildings) with the GTSS
// configuration (approach legs, crosswalks, detectors, signal heads) into one
// scene graph. Units are meters, Y is up, and the signal location sits at the
// origin with north pointing down -Z.

import * as THREE from 'three';

import { roadWidthMeters, type IntersectionMapData } from '@/lib/osm/mapData';
import type { Approach, Detector, GtssFeed, Phase } from '@/lib/gtss/types';

const METERS_PER_DEG_LAT = 111320;
const FEET_TO_METERS = 0.3048;
const LANE_WIDTH_M = 3.2;
const APPROACH_LENGTH_M = 55;
const DASH = { length: 2.2, gap: 2.4, width: 0.12, height: 0.02 };

// Matches the colors used by the 2D PhaseDiagram.
const PHASE_COLORS: Record<number, number> = {
    1: 0x22c55e,
    2: 0x3b82f6,
    3: 0xf97316,
    4: 0x8b5cf6,
    5: 0xef4444,
    6: 0x14b8a6,
    7: 0xeab308,
    8: 0xec4899,
};

const COLORS = {
    ground: 0xdde5d8,
    asphalt: 0x3c4043,
    sidewalk: 0xc9c4bb,
    laneLine: 0xf4f4f4,
    crosswalk: 0xf5f5f5,
    stopLine: 0xffffff,
    building: 0xb7ada0,
    buildingRoof: 0x9c9085,
    detector: 0x38bdf8,
    pole: 0x4b5563,
    lampOff: 0x1f2937,
    lampRed: 0xef4444,
    lampYellow: 0xfacc15,
    lampGreen: 0x22c55e,
};

export interface Intersection3DOptions {
    feed: GtssFeed;
    mapData?: IntersectionMapData | null;
}

// Projects a lat/lon into scene meters relative to the origin.
function makeProjection(originLat: number, originLon: number) {
    const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
    return (lat: number, lon: number): { x: number; z: number } => ({
        x: (lon - originLon) * metersPerDegLon,
        z: -(lat - originLat) * METERS_PER_DEG_LAT,
    });
}

// Unit direction of travel INTO the intersection for an approach whose
// compass bearing points away from the intersection.
function travelDirection(bearingDeg: number): { x: number; z: number } {
    const rad = ((bearingDeg + 180) * Math.PI) / 180;
    return { x: Math.sin(rad), z: -Math.cos(rad) };
}

function bearingOf(p0: { x: number; z: number }, p1: { x: number; z: number }): number {
    return ((Math.atan2(p1.x - p0.x, -(p1.z - p0.z)) * 180) / Math.PI + 360) % 360;
}

function flatBox(
    cx: number,
    cz: number,
    width: number,
    length: number,
    height: number,
    bearingRad: number,
    material: THREE.Material,
    y = 0
): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
    mesh.position.set(cx, y + height / 2, cz);
    mesh.rotation.y = bearingRad;
    mesh.receiveShadow = true;
    return mesh;
}

export function buildIntersectionScene({ feed, mapData }: Intersection3DOptions): THREE.Group {
    const root = new THREE.Group();
    root.name = 'intersection-3d';
    const project = makeProjection(feed.signal.latitude, feed.signal.longitude);

    const materials = {
        ground: new THREE.MeshStandardMaterial({ color: COLORS.ground, roughness: 1 }),
        asphalt: new THREE.MeshStandardMaterial({ color: COLORS.asphalt, roughness: 0.95 }),
        sidewalk: new THREE.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 1 }),
        laneLine: new THREE.MeshBasicMaterial({ color: COLORS.laneLine }),
        crosswalk: new THREE.MeshBasicMaterial({ color: COLORS.crosswalk }),
        stopLine: new THREE.MeshBasicMaterial({ color: COLORS.stopLine }),
        building: new THREE.MeshStandardMaterial({ color: COLORS.building, roughness: 0.9 }),
        detector: new THREE.MeshStandardMaterial({ color: COLORS.detector, roughness: 0.4 }),
        pole: new THREE.MeshStandardMaterial({ color: COLORS.pole, roughness: 0.5, metalness: 0.6 }),
    };

    addGround(root, materials.ground);
    if (mapData) {
        addOsmRoads(root, mapData, project, materials.asphalt);
        addBuildings(root, mapData, project, materials.building);
    }
    addApproaches(root, feed, materials);

    return root;
}

function addGround(root: THREE.Group, material: THREE.Material) {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(220, 64), material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    root.add(ground);
}

function addOsmRoads(
    root: THREE.Group,
    mapData: IntersectionMapData,
    project: (lat: number, lon: number) => { x: number; z: number },
    asphalt: THREE.Material
) {
    const center = new THREE.Mesh(new THREE.CircleGeometry(13, 40), asphalt);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.0;
    root.add(center);

    for (const road of mapData.roads) {
        if (road.points.length < 2) continue;
        const width = roadWidthMeters(road);
        const pts = road.points.map((p) => project(p.lat, p.lon));
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const length = Math.hypot(dx, dz);
            if (length < 0.5) continue;
            const bearingRad = Math.atan2(dx, dz);
            root.add(flatBox((a.x + b.x) / 2, (a.z + b.z) / 2, width, length + width * 0.5, 0.06, bearingRad, asphalt));
        }
    }
}

function addBuildings(
    root: THREE.Group,
    mapData: IntersectionMapData,
    project: (lat: number, lon: number) => { x: number; z: number },
    material: THREE.Material
) {
    for (const building of mapData.buildings) {
        if (building.points.length < 3) continue;
        const height = building.height ?? (building.levels != null ? building.levels * 3 : 8);
        const shape = new THREE.Shape();
        building.points.forEach((p, index) => {
            const { x, z } = project(p.lat, p.lon);
            if (index === 0) shape.moveTo(x, z);
            else shape.lineTo(x, z);
        });

        const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
        // Shape lies in the X/Y plane and extrudes along +Z; rotate -90° about
        // X so +Z becomes +Y (up) and shape Y maps back to scene Z unchanged.
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(0, height, 0);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
    }
}

function addApproaches(
    root: THREE.Group,
    feed: GtssFeed,
    materials: {
        asphalt: THREE.Material;
        sidewalk: THREE.Material;
        laneLine: THREE.Material;
        crosswalk: THREE.Material;
        stopLine: THREE.Material;
        detector: THREE.Material;
        pole: THREE.Material;
    }
) {
    const phasesByApproach = new Map<string, Phase[]>();
    for (const phase of feed.phases) {
        if (!phase.approachId) continue;
        const list = phasesByApproach.get(phase.approachId) ?? [];
        list.push(phase);
        phasesByApproach.set(phase.approachId, list);
    }

    feed.approaches.forEach((approach, index) => {
        const bearing = approach.compassBearing ?? defaultBearing(index, feed.approaches.length);
        const approachPhases = phasesByApproach.get(approach.approachId) ?? [];
        addApproach(root, feed, approach, bearing, approachPhases, materials);
    });

    addCrosswalks(root, feed, materials.crosswalk);
}

function defaultBearing(index: number, total: number): number {
    // Spread approaches evenly (4-way by default): 0, 90, 180, 270...
    const step = total > 0 ? 360 / Math.max(total, 4) : 90;
    return Math.round(index * step) % 360;
}

function addApproach(
    root: THREE.Group,
    feed: GtssFeed,
    approach: Approach,
    bearing: number,
    approachPhases: Phase[],
    materials: {
        asphalt: THREE.Material;
        sidewalk: THREE.Material;
        laneLine: THREE.Material;
        crosswalk: THREE.Material;
        stopLine: THREE.Material;
        detector: THREE.Material;
        pole: THREE.Material;
    }
) {
    const dir = travelDirection(bearing);
    const perp = { x: -dir.z, z: dir.x }; // right side when looking toward the intersection
    const bearingRad = Math.atan2(dir.x, dir.z);

    const vehiclePhases = approachPhases.filter((p) => p.movementType !== 'Pedestrian');
    const laneCount = Math.max(
        vehiclePhases.reduce((sum, p) => sum + (p.numOfLanes || 1), 0),
        vehiclePhases.length,
        1
    );
    const inboundWidth = laneCount * LANE_WIDTH_M;
    const outboundWidth = Math.max(inboundWidth, LANE_WIDTH_M);
    const roadWidth = inboundWidth + outboundWidth;
    const mid = APPROACH_LENGTH_M / 2;

    // Road surface: centered on the middle of both directions.
    const centerOffset = (inboundWidth - outboundWidth) / 2;
    const roadCenter = {
        x: dir.x * mid + perp.x * centerOffset,
        z: dir.z * mid + perp.z * centerOffset,
    };
    root.add(flatBox(roadCenter.x, roadCenter.z, roadWidth, APPROACH_LENGTH_M + 12, 0.08, bearingRad, materials.asphalt));

    // Sidewalks along both edges of the carriageway.
    const sidewalkWidth = 2.2;
    const edgeOffset = roadWidth / 2 + sidewalkWidth / 2;
    for (const side of [-1, 1]) {
        const cx = roadCenter.x + perp.x * edgeOffset * side;
        const cz = roadCenter.z + perp.z * edgeOffset * side;
        root.add(
            flatBox(cx, cz, sidewalkWidth, APPROACH_LENGTH_M + 12, 0.12, bearingRad, materials.sidewalk, 0.02)
        );
    }

    // Dashed lane divider between inbound lanes.
    for (let lane = 1; lane < laneCount; lane++) {
        const offset = lane * LANE_WIDTH_M;
        for (let d = 10; d < APPROACH_LENGTH_M; d += DASH.length + DASH.gap) {
            const cx = dir.x * (d + DASH.length / 2) + perp.x * offset;
            const cz = dir.z * (d + DASH.length / 2) + perp.z * offset;
            root.add(flatBox(cx, cz, DASH.width, DASH.length, DASH.height, bearingRad, materials.laneLine, 0.09));
        }
    }

    // Solid center line between the two directions of travel.
    for (let d = 8; d < APPROACH_LENGTH_M; d += 6) {
        const cx = dir.x * (d + 2.5) + perp.x * 0;
        const cz = dir.z * (d + 2.5) + perp.z * 0;
        root.add(flatBox(cx, cz, DASH.width, 5, DASH.height, bearingRad, materials.laneLine, 0.09));
    }

    // Stop bar across the inbound lanes, just before the crosswalk.
    const stopbarDist = 7;
    const stopCenter = { x: dir.x * stopbarDist + perp.x * (inboundWidth / 2), z: dir.z * stopbarDist + perp.z * (inboundWidth / 2) };
    root.add(flatBox(stopCenter.x, stopCenter.z, inboundWidth, 0.45, 0.02, bearingRad, materials.stopLine, 0.1));

    // Detectors lie in the lane behind the stop bar.
    addDetectors(root, feed, approachPhases, dir, perp, bearingRad, stopbarDist, laneCount, materials.detector);

    // Signal pole + heads on the right-hand side of the inbound lanes.
    addSignalPole(root, approach, dir, perp, bearingRad, inboundWidth, vehiclePhases, materials);
}

function addDetectors(
    root: THREE.Group,
    feed: GtssFeed,
    approachPhases: Phase[],
    dir: { x: number; z: number },
    perp: { x: number; z: number },
    bearingRad: number,
    stopbarDist: number,
    laneCount: number,
    material: THREE.Material
) {
    const phaseNumbers = new Set(approachPhases.map((p) => p.phase));
    for (const detector of feed.detectors) {
        if (!phaseNumbers.has(detector.phase)) continue;
        const lane = Math.min(Math.max(Number.parseInt(detector.lane ?? '1', 10) || 1, 1), Math.max(laneCount, 1));
        const lengthM = Math.max((detector.length ?? 6) * FEET_TO_METERS, 1);
        const setbackM = Math.max((detector.stopbarSetbackDist ?? 0) * FEET_TO_METERS, 0);
        const laneCenterOffset = (lane - 0.5) * LANE_WIDTH_M;
        const dist = stopbarDist + 0.5 + setbackM + lengthM / 2;
        const cx = dir.x * dist + perp.x * laneCenterOffset;
        const cz = dir.z * dist + perp.z * laneCenterOffset;
        root.add(flatBox(cx, cz, LANE_WIDTH_M * 0.72, lengthM, 0.03, bearingRad, material, 0.1));
    }
}

function addSignalPole(
    root: THREE.Group,
    approach: Approach,
    dir: { x: number; z: number },
    perp: { x: number; z: number },
    bearingRad: number,
    inboundWidth: number,
    vehiclePhases: Phase[],
    materials: { pole: THREE.Material }
) {
    const poleHeight = 6;
    const armLength = Math.max(inboundWidth * 0.75, 4);
    const baseDist = 5.4;
    const baseOffset = inboundWidth + 1.2;
    const base = { x: dir.x * baseDist + perp.x * baseOffset, z: dir.z * baseDist + perp.z * baseOffset };

    const group = new THREE.Group();
    group.position.set(base.x, 0, base.z);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, poleHeight, 12), materials.pole);
    pole.position.y = poleHeight / 2;
    pole.castShadow = true;
    group.add(pole);

    // Mast arm reaching back over the inbound lanes. The cylinder's local Y
    // axis is aligned with the arm direction (toward -perp) via quaternion.
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, armLength, 10), materials.pole);
    const armDir = new THREE.Vector3(-perp.x, 0, -perp.z).normalize();
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir);
    arm.position.set((-perp.x * armLength) / 2, poleHeight - 0.25, (-perp.z * armLength) / 2);
    arm.castShadow = true;
    group.add(arm);

    // One three-lamp head per distinct vehicle phase, spread along the arm.
    const heads = Math.max(vehiclePhases.length, 1);
    for (let i = 0; i < heads; i++) {
        const phase = vehiclePhases[i];
        const along = armLength * ((i + 1) / (heads + 1));
        const hx = -perp.x * along;
        const hz = -perp.z * along;
        const head = makeSignalHead(phase?.phase, bearingRad);
        head.position.set(hx, poleHeight - 0.7, hz);
        group.add(head);
    }

    root.add(group);
}

function makeSignalHead(phaseNumber: number | undefined, bearingRad: number): THREE.Group {
    const head = new THREE.Group();
    const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 1.0, 0.28),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 })
    );
    housing.castShadow = true;
    head.add(housing);

    const phaseColor = phaseNumber != null ? PHASE_COLORS[phaseNumber] : undefined;
    const lampColors = [COLORS.lampRed, COLORS.lampYellow, phaseColor ?? COLORS.lampGreen];
    lampColors.forEach((color, index) => {
        const lamp = new THREE.Mesh(
            new THREE.CircleGeometry(0.11, 20),
            new THREE.MeshBasicMaterial({ color })
        );
        // Lamps face oncoming traffic (same direction the road runs).
        lamp.position.set(0, 0.32 - index * 0.32, 0.15);
        head.add(lamp);
    });

    head.rotation.y = bearingRad;
    return head;
}

// Pedestrian crossing modes mirror the 2D PhaseDiagram:
//   0 = none, 1 = on assigned approach, 2 = assigned+opposite, 3 = opposite only,
//   4/5 = diagonals, 6 = both diagonals, 7 = full scramble.
function addCrosswalks(root: THREE.Group, feed: GtssFeed, material: THREE.Material) {
    const approachesById = new Map(feed.approaches.map((a) => [a.approachId, a]));
    let fallbackIndex = 0;

    const bearingFor = (phase: Phase): number | null => {
        const approach = phase.approachId ? approachesById.get(phase.approachId) : undefined;
        if (approach?.compassBearing != null) return approach.compassBearing;
        if (approach) {
            const idx = feed.approaches.indexOf(approach);
            return defaultBearing(idx, feed.approaches.length);
        }
        return defaultBearing(fallbackIndex++, Math.max(feed.approaches.length, 4));
    };

    const drawn = new Set<number>();

    for (const phase of feed.phases) {
        const mode = typeof phase.isPedestrian === 'number' ? phase.isPedestrian : phase.isPedestrian ? 1 : 0;
        if (mode === 0) continue;
        const bearing = bearingFor(phase);
        if (bearing == null) continue;

        const addAt = (b: number) => {
            const key = Math.round(b) % 360;
            if (drawn.has(key)) return;
            drawn.add(key);
            addCrosswalkAt(root, b, material);
        };

        if (mode === 1 || mode === 2) addAt(bearing);
        if (mode === 2 || mode === 3) addAt(bearing + 180);
        if (mode === 4 || mode === 6 || mode === 7) addDiagonal(root, 1, material);
        if (mode === 5 || mode === 6 || mode === 7) addDiagonal(root, -1, material);
        if (mode === 7) {
            addAt(bearing);
            addAt(bearing + 90);
            addAt(bearing + 180);
            addAt(bearing + 270);
        }
    }
}

// A zebra crossing across the mouth of the approach with the given bearing.
function addCrosswalkAt(root: THREE.Group, bearing: number, material: THREE.Material) {
    const dir = travelDirection(bearing);
    const perp = { x: -dir.z, z: dir.x };
    const bearingRad = Math.atan2(dir.x, dir.z);
    const crossingDist = 5.2; // between intersection center and stop bar
    const roadHalfWidth = 5.5;

    const stripes = 9;
    for (let i = 0; i < stripes; i++) {
        const offset = -roadHalfWidth + ((i + 0.5) / stripes) * roadHalfWidth * 2;
        const cx = dir.x * crossingDist + perp.x * offset;
        const cz = dir.z * crossingDist + perp.z * offset;
        // Stripes run parallel to travel direction (zebra style).
        root.add(flatBox(cx, cz, 0.45, 2.4, 0.02, bearingRad, material, 0.11));
    }
}

function addDiagonal(root: THREE.Group, sign: 1 | -1, material: THREE.Material) {
    const half = 9.5;
    const cx = 0;
    const cz = 0;
    const length = Math.hypot(half * 2, half * 2);
    const angle = Math.atan2(half * sign, half);
    const stripe = flatBox(cx, cz, 1.2, length, 0.02, angle, material, 0.1);
    root.add(stripe);
}
