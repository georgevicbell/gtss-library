// Types ported from the official GTSS-Signal-Builder app's data model.
// Source: https://github.com/redmond2742/GTSS-Signal-Builder/blob/main/shared/schema.ts

export type MovementType =
  | 'Through'
  | 'Left Turn'
  | 'Left Protected-Permissive'
  | 'Left Through Shared'
  | 'Permissive Phase'
  | 'Flashing Yellow Arrow'
  | 'U-Turn'
  | 'Right Turn'
  | 'Through-Right'
  | 'Pedestrian';

export const MOVEMENT_TYPES: MovementType[] = [
  'Through',
  'Left Turn',
  'Left Protected-Permissive',
  'Left Through Shared',
  'Permissive Phase',
  'Flashing Yellow Arrow',
  'U-Turn',
  'Right Turn',
  'Through-Right',
  'Pedestrian',
];

// Short codes used in phases.txt exports, keyed by the full movement type name.
export const MOVEMENT_TYPE_CODES: Record<MovementType, string> = {
  Through: 'T',
  'Left Turn': 'L',
  'Left Protected-Permissive': 'LPP',
  'Left Through Shared': 'LT',
  'Permissive Phase': 'TL',
  'Flashing Yellow Arrow': 'FYA',
  'U-Turn': 'U',
  'Right Turn': 'R',
  'Through-Right': 'TR',
  Pedestrian: 'PED',
};

// Pedestrian crossing mode, 0-7. See crosswalkLengthCode/generatePhasesCSV for usage.
export type PedestrianMode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const PEDESTRIAN_MODES: PedestrianMode[] = [0, 1, 2, 3, 4, 5, 6, 7];

// 0 = none, 1 = FR (slip lane), 2 = FR-P (with ped crossing), 3 = FR-P-I (improved).
export type FreeRight = 0 | 1 | 2 | 3;
export const FREE_RIGHT_VALUES: FreeRight[] = [0, 1, 2, 3];

export type VehRecallType = 'None' | 'Min' | 'Max' | 'Soft';
export const VEH_RECALL_TYPES: VehRecallType[] = ['None', 'Min', 'Max', 'Soft'];

export interface Agency {
  agencyId: string;
  agencyName: string;
  agencyUrl: string | null;
  agencyTimezone: string;
  agencyLanguage: string | null;
  agencyEmail: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Signal {
  signalId: string;
  agencyId: string;
  streetName1: string;
  streetName2: string;
  latitude: number;
  longitude: number;
}

export interface Approach {
  approachId: string;
  signalId: string;
  streetName: string;
  compassBearing: number | null;
  postedSpeed: number | null;
  freeRight: FreeRight;
  freeRightLanes: number;
}

export interface Phase {
  phase: number;
  signalId: string;
  movementType: MovementType;
  isPedestrian: PedestrianMode;
  numOfLanes: number;
  approachId: string | null;
  // Measured crosswalk length in feet; null means "not measured" (an LE-#/TE-# estimate is exported instead).
  crosswalkLength: number | null;
}

export interface Detector {
  channel: string;
  signalId: string;
  phase: number;
  description: string | null;
  purpose: string;
  vehicleType: string | null;
  lane: string | null;
  technologyType: string;
  length: number | null;
  stopbarSetbackDist: number | null;
}

export interface BasicTiming {
  phase: number;
  signalId: string;
  pedWalk: number | null;
  pedClearance: number | null;
  leadingPedInterval: number | null;
  minGreen: number | null;
  maxGreen: number | null;
  yellow: number | null;
  allRed: number | null;
  vehRecallType: VehRecallType;
  pedRecall: boolean;
}

// A full GTSS feed for a single intersection (signalId).
export interface GtssFeed {
  signalId: string;
  agency: Agency;
  signal: Signal;
  approaches: Approach[];
  phases: Phase[];
  detectors: Detector[];
  basicTimings: BasicTiming[];
}
