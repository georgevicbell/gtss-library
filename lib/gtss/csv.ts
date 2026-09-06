// CSV generation and parsing ported from the official GTSS-Signal-Builder app.
// Source: https://github.com/redmond2742/GTSS-Signal-Builder/blob/main/client/src/lib/localStorage.ts
import type { Agency, Approach, BasicTiming, Detector, FreeRight, MovementType, PedestrianMode, Phase, Signal, VehRecallType } from './types';
import { MOVEMENT_TYPE_CODES, MOVEMENT_TYPES } from './types';

// Prevents CSV formula-injection: quotes fields with commas/quotes/newlines, and
// neutralizes values starting with =, +, -, @ or a tab/CR (which spreadsheets treat as formulas).
function sanitizeCSVField(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    const strValue = String(value);
    if (/[",\n\r]/.test(strValue)) {
        return `"${strValue.replace(/"/g, '""')}"`;
    }
    if (/^[=+\-@\t\r]/.test(strValue)) {
        return `"'${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
}

export function agenciesToCsv(agencies: Agency[]): string {
    const headers = 'agency_id,agency_name,agency_url,agency_timezone,agency_email';
    if (agencies.length === 0) return headers + '\n';
    const rows = agencies.map((agency) =>
        [
            sanitizeCSVField(agency.agencyId),
            sanitizeCSVField(agency.agencyName),
            sanitizeCSVField(agency.agencyUrl),
            sanitizeCSVField(agency.agencyTimezone),
            sanitizeCSVField(agency.agencyEmail),
        ].join(',')
    );
    return [headers, ...rows].join('\n') + '\n';
}

export function agencyToCsv(agency: Agency | null): string {
    return agenciesToCsv(agency ? [agency] : []);
}

export function signalsToCsv(signals: Signal[]): string {
    const headers = 'signal_id,agency_id,latitude,longitude';
    if (signals.length === 0) return headers + '\n';
    const rows = signals.map((signal) =>
        [
            sanitizeCSVField(signal.signalId),
            sanitizeCSVField(signal.agencyId),
            sanitizeCSVField(signal.latitude),
            sanitizeCSVField(signal.longitude),
        ].join(',')
    );
    return [headers, ...rows].join('\n') + '\n';
}

// free_right column: '' = none, 'FR' = slip lane, 'FR-P' = with ped crossing, 'FR-P-I' = improved.
// Prefixed with the lane count when more than one free-right lane exists, e.g. "2-FR-P".
function freeRightLabel(value: number, lanes: number): string {
    const code = value === 3 ? 'FR-P-I' : value === 2 ? 'FR-P' : value === 1 ? 'FR' : '';
    if (!code) return '';
    const n = lanes > 1 ? lanes : 1;
    return n > 1 ? `${n}-${code}` : code;
}

export function approachesToCsv(approaches: Approach[]): string {
    const headers = 'approach_id,signal_id,street_name,compass_bearing,posted_speed,free_right';
    if (approaches.length === 0) return headers + '\n';

    const sorted = [...approaches].sort((a, b) => {
        if (a.signalId !== b.signalId) return a.signalId.localeCompare(b.signalId);
        return a.approachId.localeCompare(b.approachId);
    });

    const rows = sorted.map((approach) =>
        [
            sanitizeCSVField(approach.approachId),
            sanitizeCSVField(approach.signalId),
            sanitizeCSVField(approach.streetName),
            sanitizeCSVField(approach.compassBearing),
            sanitizeCSVField(approach.postedSpeed),
            freeRightLabel(approach.freeRight, approach.freeRightLanes),
        ].join(',')
    );
    return [headers, ...rows].join('\n') + '\n';
}

const FT_PER_LANE = 12;
const WALKING_SPEED_FPS = 3.5;

type MovementGroup = 'left' | 'right' | 'through' | 'ped';

function movementGroup(movementType: Phase['movementType']): MovementGroup {
    switch (movementType) {
        case 'Left Turn':
        case 'Left Protected-Permissive':
        case 'Flashing Yellow Arrow':
        case 'U-Turn':
            return 'left';
        case 'Right Turn':
            return 'right';
        case 'Pedestrian':
            return 'ped';
        default:
            return 'through';
    }
}

// Crosswalk length code for phases.txt. A measured value always wins; otherwise estimates:
//   LE-#  lane-estimated distance: 12 ft x (inbound lanes + departure lanes on the crossed leg)
//   TE-#  time-estimated distance: ped clearance x 3.5 ft/s walking speed
//   (the shorter of LE and TE is exported when both exist)
export function crosswalkLengthCode(
    phase: Phase,
    allPhases: Phase[],
    basicTimings: BasicTiming[],
    approaches: Approach[]
): string {
    if (typeof phase.crosswalkLength === 'number' && phase.crosswalkLength > 0) {
        return String(phase.crosswalkLength);
    }

    const pedMode = phase.isPedestrian ?? 0;
    if (pedMode === 0) return '';

    let laneEstimate: number | null = null;
    if (phase.approachId) {
        const maxByGroup = { left: 0, right: 0, through: 0 };
        allPhases
            .filter((p) => p.signalId === phase.signalId && p.approachId === phase.approachId)
            .forEach((p) => {
                const g = movementGroup(p.movementType);
                if (g === 'ped') return;
                maxByGroup[g] = Math.max(maxByGroup[g], p.numOfLanes || 1);
            });
        const inboundLanes = maxByGroup.left + maxByGroup.right + maxByGroup.through;

        let departureLanes = 0;
        const findApproach = (approachId: string | null) =>
            approaches.find((a) => a.approachId === approachId && a.signalId === phase.signalId);
        const crossedLeg = findApproach(phase.approachId);
        if (crossedLeg?.compassBearing != null) {
            const outbound = (crossedLeg.compassBearing + 180) % 360;
            const angDiff = (a: number, b: number) => {
                const d = Math.abs((((a - b) % 360) + 360) % 360);
                return Math.min(d, 360 - d);
            };
            allPhases
                .filter((p) => p.signalId === phase.signalId && p.approachId)
                .forEach((p) => {
                    const ap = findApproach(p.approachId);
                    if (ap?.compassBearing == null) return;
                    const b = ap.compassBearing;
                    const headings: number[] = [];
                    switch (p.movementType) {
                        case 'Through':
                            headings.push(b);
                            break;
                        case 'Through-Right':
                            headings.push(b, b + 90);
                            break;
                        case 'Left Turn':
                        case 'Left Protected-Permissive':
                        case 'Flashing Yellow Arrow':
                            headings.push(b - 90);
                            break;
                        case 'Left Through Shared':
                        case 'Permissive Phase':
                            headings.push(b, b - 90);
                            break;
                        case 'Right Turn':
                            headings.push(b + 90);
                            break;
                        case 'U-Turn':
                            headings.push(b + 180);
                            break;
                        default:
                            return;
                    }
                    if (headings.some((h) => angDiff(h, outbound) <= 45)) {
                        departureLanes = Math.max(departureLanes, p.numOfLanes || 1);
                    }
                });
        }

        const totalLanes = inboundLanes + departureLanes;
        if (totalLanes > 0) laneEstimate = totalLanes * FT_PER_LANE;
    }

    let timeEstimate: number | null = null;
    const timing = basicTimings.find((t) => t.signalId === phase.signalId && t.phase === phase.phase);
    if (timing?.pedClearance && timing.pedClearance > 0) {
        timeEstimate = Math.round(timing.pedClearance * WALKING_SPEED_FPS);
    }

    if (laneEstimate !== null && timeEstimate !== null) {
        return timeEstimate < laneEstimate ? `TE-${timeEstimate}` : `LE-${laneEstimate}`;
    }
    if (timeEstimate !== null) return `TE-${timeEstimate}`;
    if (laneEstimate !== null) return `LE-${laneEstimate}`;
    return '';
}

export function phasesToCsv(phases: Phase[], basicTimings: BasicTiming[], approaches: Approach[]): string {
    const headers = 'phase,signal_id,movement_type,num_of_lanes,approach_id,PedX,crosswalk_length';
    if (phases.length === 0) return headers + '\n';

    const sorted = [...phases].sort((a, b) => {
        if (a.signalId !== b.signalId) return a.signalId.localeCompare(b.signalId);
        return a.phase - b.phase;
    });

    const rows = sorted.map((phase) => {
        const encodedMovementType = MOVEMENT_TYPE_CODES[phase.movementType] ?? phase.movementType;
        const crosswalk = crosswalkLengthCode(phase, phases, basicTimings, approaches);
        return [
            sanitizeCSVField(phase.phase),
            sanitizeCSVField(phase.signalId),
            sanitizeCSVField(encodedMovementType),
            sanitizeCSVField(phase.numOfLanes || 1),
            sanitizeCSVField(phase.approachId),
            sanitizeCSVField(phase.isPedestrian),
            crosswalk,
        ].join(',');
    });
    return [headers, ...rows].join('\n') + '\n';
}

export function detectorsToCsv(detectors: Detector[]): string {
    const headers =
        'channel,signal_id,phase,description,purpose,vehicle_type,lane,technology_type,length,stopbar_setback_dist';
    if (detectors.length === 0) return headers + '\n';
    const rows = detectors.map((detector) =>
        [
            sanitizeCSVField(detector.channel),
            sanitizeCSVField(detector.signalId),
            sanitizeCSVField(detector.phase),
            sanitizeCSVField(detector.description),
            sanitizeCSVField(detector.purpose),
            sanitizeCSVField(detector.vehicleType),
            sanitizeCSVField(detector.lane),
            sanitizeCSVField(detector.technologyType),
            sanitizeCSVField(detector.length),
            sanitizeCSVField(detector.stopbarSetbackDist),
        ].join(',')
    );
    return [headers, ...rows].join('\n') + '\n';
}

export function basicTimingsToCsv(timings: BasicTiming[]): string {
    const headers =
        'phase,signal_id,ped_walk,ped_clearance,leading_ped_interval,min_green,max_green,yellow,all_red,veh_recall_type,ped_recall';
    if (timings.length === 0) return headers + '\n';

    const sorted = [...timings].sort((a, b) => {
        if (a.signalId !== b.signalId) return a.signalId.localeCompare(b.signalId);
        return a.phase - b.phase;
    });

    const rows = sorted.map((t) =>
        [
            sanitizeCSVField(t.phase),
            sanitizeCSVField(t.signalId),
            sanitizeCSVField(t.pedWalk),
            sanitizeCSVField(t.pedClearance),
            sanitizeCSVField(t.leadingPedInterval),
            sanitizeCSVField(t.minGreen),
            sanitizeCSVField(t.maxGreen),
            sanitizeCSVField(t.yellow),
            sanitizeCSVField(t.allRed),
            sanitizeCSVField(t.vehRecallType),
            sanitizeCSVField(t.pedRecall),
        ].join(',')
    );
    return [headers, ...rows].join('\n') + '\n';
}

const CODE_TO_MOVEMENT_TYPE: Record<string, MovementType> = {
    T: 'Through',
    L: 'Left Turn',
    LPP: 'Left Protected-Permissive',
    LT: 'Left Through Shared',
    TL: 'Permissive Phase',
    FYA: 'Flashing Yellow Arrow',
    U: 'U-Turn',
    R: 'Right Turn',
    TR: 'Through-Right',
    PED: 'Pedestrian',
};

// General-purpose RFC-4180 CSV parser supporting quotes, escaped quotes, multiline values.
export function parseCsv(text: string): Record<string, string>[] {
    const lines: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                cell += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                cell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(cell.trim());
                cell = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && nextChar === '\n') i++;
                row.push(cell.trim());
                if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
                    lines.push(row);
                }
                row = [];
                cell = '';
            } else {
                cell += char;
            }
        }
    }
    if (cell.length > 0 || row.length > 0) {
        row.push(cell.trim());
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
            lines.push(row);
        }
    }
    if (lines.length < 2) return [];

    const headers = lines[0].map((h) => h.replace(/^["']+|["']+$/g, '').trim());
    return lines.slice(1).map((line) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
            let val = line[idx] !== undefined ? line[idx] : '';
            if (val.startsWith("'=") || val.startsWith("'+") || val.startsWith("'-") || val.startsWith("'@")) {
                val = val.slice(1);
            }
            obj[h] = val;
        });
        return obj;
    });
}

export function parseAgenciesCsv(text: string): Agency[] {
    const rows = parseCsv(text);
    return rows.map((row) => ({
        agencyId: row.agency_id || row.agencyId || '',
        agencyName: row.agency_name || row.agencyName || '',
        agencyUrl: row.agency_url || row.agencyUrl || null,
        agencyTimezone: row.agency_timezone || row.agencyTimezone || 'UTC',
        agencyLanguage: row.agency_lang || row.agency_language || row.agencyLanguage || null,
        agencyEmail: row.agency_email || row.agencyEmail || null,
        latitude: row.agency_lat || row.latitude ? parseFloat(row.agency_lat || row.latitude) : null,
        longitude: row.agency_lon || row.longitude ? parseFloat(row.agency_lon || row.longitude) : null,
    })).filter((a) => Boolean(a.agencyId));
}

export function parseSignalsCsv(text: string): Signal[] {
    const rows = parseCsv(text);
    return rows.map((row) => {
        const lat = parseFloat(row.latitude || row.lat || '0');
        const lon = parseFloat(row.longitude || row.lon || '0');
        return {
            signalId: row.signal_id || row.signalId || '',
            agencyId: row.agency_id || row.agencyId || '',
            streetName1: row.street_name1 || row.street_name_1 || row.streetName1 || '',
            streetName2: row.street_name2 || row.street_name_2 || row.streetName2 || '',
            latitude: Number.isFinite(lat) ? lat : 0,
            longitude: Number.isFinite(lon) ? lon : 0,
        };
    }).filter((s) => Boolean(s.signalId));
}

export function parseApproachesCsv(text: string): Approach[] {
    const rows = parseCsv(text);
    return rows.map((row) => {
        const bearing = row.compass_bearing || row.compassBearing;
        const speed = row.posted_speed || row.postedSpeed;

        let freeRight: FreeRight = 0;
        let freeRightLanes = 0;
        const frRaw = (row.free_right || row.freeRight || '').trim();
        if (frRaw) {
            let code = frRaw;
            let lanes = 1;
            const match = frRaw.match(/^(\d+)-(.*)$/);
            if (match) {
                lanes = parseInt(match[1], 10) || 1;
                code = match[2];
            }
            if (code === 'FR-P-I' || code === '3') {
                freeRight = 3;
                freeRightLanes = lanes;
            } else if (code === 'FR-P' || code === '2') {
                freeRight = 2;
                freeRightLanes = lanes;
            } else if (code === 'FR' || code === '1') {
                freeRight = 1;
                freeRightLanes = lanes;
            }
        }

        return {
            approachId: row.approach_id || row.approachId || '',
            signalId: row.signal_id || row.signalId || '',
            streetName: row.street_name || row.streetName || '',
            compassBearing: bearing !== undefined && bearing !== '' ? parseFloat(bearing) : null,
            postedSpeed: speed !== undefined && speed !== '' ? parseFloat(speed) : null,
            freeRight,
            freeRightLanes,
        };
    }).filter((a) => Boolean(a.approachId && a.signalId));
}

export function parsePhasesCsv(text: string): Phase[] {
    const rows = parseCsv(text);
    return rows.map((row) => {
        const phaseNum = parseInt(row.phase, 10);
        const movRaw = (row.movement_type || row.movementType || '').trim();
        const movementType: MovementType =
            CODE_TO_MOVEMENT_TYPE[movRaw] ||
            (MOVEMENT_TYPES.includes(movRaw as MovementType) ? (movRaw as MovementType) : 'Through');

        const pedXRaw = parseInt(row.PedX || row.ped_x || row.is_pedestrian || row.isPedestrian || '0', 10);
        const isPedestrian: PedestrianMode = (Number.isFinite(pedXRaw) && pedXRaw >= 0 && pedXRaw <= 7
            ? pedXRaw
            : 0) as PedestrianMode;

        const lanes = parseInt(row.num_of_lanes || row.numOfLanes || '1', 10);

        const crosswalkRaw = (row.crosswalk_length || row.crosswalkLength || '').trim();
        let crosswalkLength: number | null = null;
        if (crosswalkRaw && !crosswalkRaw.startsWith('LE-') && !crosswalkRaw.startsWith('TE-')) {
            const parsedCrosswalk = parseFloat(crosswalkRaw);
            if (Number.isFinite(parsedCrosswalk)) crosswalkLength = parsedCrosswalk;
        }

        return {
            phase: Number.isFinite(phaseNum) ? phaseNum : 0,
            signalId: row.signal_id || row.signalId || '',
            movementType,
            isPedestrian,
            numOfLanes: Number.isFinite(lanes) && lanes > 0 ? lanes : 1,
            approachId: row.approach_id || row.approachId || null,
            crosswalkLength,
        };
    }).filter((p) => Boolean(p.signalId && p.phase));
}

export function parseDetectorsCsv(text: string): Detector[] {
    const rows = parseCsv(text);
    return rows.map((row) => {
        const phaseNum = parseInt(row.phase, 10);
        const lenRaw = row.length;
        const setbackRaw = row.stopbar_setback_dist || row.stopbarSetbackDist;

        return {
            channel: row.channel || '',
            signalId: row.signal_id || row.signalId || '',
            phase: Number.isFinite(phaseNum) ? phaseNum : 0,
            description: row.description || null,
            purpose: row.purpose || 'actuation',
            vehicleType: row.vehicle_type || row.vehicleType || null,
            lane: row.lane || null,
            technologyType: row.technology_type || row.technologyType || 'inductive',
            length: lenRaw !== undefined && lenRaw !== '' ? parseFloat(lenRaw) : null,
            stopbarSetbackDist: setbackRaw !== undefined && setbackRaw !== '' ? parseFloat(setbackRaw) : null,
        };
    }).filter((d) => Boolean(d.channel && d.signalId));
}

export function parseBasicTimingsCsv(text: string): BasicTiming[] {
    const rows = parseCsv(text);
    return rows.map((row) => {
        const phaseNum = parseInt(row.phase, 10);
        const recallRaw = (row.veh_recall_type || row.vehRecallType || 'None').trim();
        const vehRecallType: VehRecallType =
            recallRaw === 'Min' || recallRaw === 'Max' || recallRaw === 'Soft' ? recallRaw : 'None';
        const pedRecallRaw = (row.ped_recall || row.pedRecall || '').trim().toLowerCase();
        const pedRecall = pedRecallRaw === 'true' || pedRecallRaw === '1';

        const parseNum = (v: string | undefined) => (v !== undefined && v !== '' ? parseFloat(v) : null);

        return {
            phase: Number.isFinite(phaseNum) ? phaseNum : 0,
            signalId: row.signal_id || row.signalId || '',
            pedWalk: parseNum(row.ped_walk || row.pedWalk),
            pedClearance: parseNum(row.ped_clearance || row.pedClearance),
            leadingPedInterval: parseNum(row.leading_ped_interval || row.leadingPedInterval),
            minGreen: parseNum(row.min_green || row.minGreen),
            maxGreen: parseNum(row.max_green || row.maxGreen),
            yellow: parseNum(row.yellow),
            allRed: parseNum(row.all_red || row.allRed),
            vehRecallType,
            pedRecall,
        };
    }).filter((t) => Boolean(t.signalId && t.phase));
}

