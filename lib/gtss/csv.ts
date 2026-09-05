// CSV generation ported from the official GTSS-Signal-Builder app.
// Source: https://github.com/redmond2742/GTSS-Signal-Builder/blob/main/client/src/lib/localStorage.ts
import type { Agency, Approach, BasicTiming, Detector, Phase, Signal } from './types';
import { MOVEMENT_TYPE_CODES } from './types';

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

export function agencyToCsv(agency: Agency | null): string {
    const headers = 'agency_id,agency_name,agency_url,agency_timezone,agency_email';
    if (!agency) return headers + '\n';
    return [
        headers,
        [
            sanitizeCSVField(agency.agencyId),
            sanitizeCSVField(agency.agencyName),
            sanitizeCSVField(agency.agencyUrl),
            sanitizeCSVField(agency.agencyTimezone),
            sanitizeCSVField(agency.agencyEmail),
        ].join(','),
    ].join('\n') + '\n';
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

