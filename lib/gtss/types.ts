// Types mirroring the GTSS (General Traffic Signal Specification) schema.
// See https://redmond2742.github.io/GTSS/documentation/ for field definitions.

export type MovementType = 'T' | 'L' | 'LT' | 'TL' | 'LPP' | 'FYA' | 'U' | 'R' | 'TR' | 'PED';

export const MOVEMENT_TYPES: MovementType[] = [
  'T',
  'L',
  'LT',
  'TL',
  'LPP',
  'FYA',
  'U',
  'R',
  'TR',
  'PED',
];

// 0-7, see phases.txt docs for the meaning of each value.
export type PedX = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const PED_X_VALUES: PedX[] = [0, 1, 2, 3, 4, 5, 6, 7];

export type DetectorPurpose = 'stop bar' | 'advanced' | 'count';
export const DETECTOR_PURPOSES: DetectorPurpose[] = ['stop bar', 'advanced', 'count'];

export type DetectorVehicleType = 'car' | 'truck' | 'bus' | 'bicycle' | 'pedestrian';
export const DETECTOR_VEHICLE_TYPES: DetectorVehicleType[] = [
  'car',
  'truck',
  'bus',
  'bicycle',
  'pedestrian',
];

export type DetectorTechnology =
  | 'inductive_loop'
  | 'radar'
  | 'microwave'
  | 'lidar'
  | 'magnetometer'
  | 'hybrid'
  | 'video';
export const DETECTOR_TECHNOLOGIES: DetectorTechnology[] = [
  'inductive_loop',
  'radar',
  'microwave',
  'lidar',
  'magnetometer',
  'hybrid',
  'video',
];

export type DetectorMode = 'pulse' | 'presence';
export const DETECTOR_MODES: DetectorMode[] = ['pulse', 'presence'];

export type VehRecallType = 'None' | 'Min' | 'Max' | 'Soft';
export const VEH_RECALL_TYPES: VehRecallType[] = ['None', 'Min', 'Max', 'Soft'];

export interface Agency {
  agency_id: string;
  agency_name: string;
  agency_url: string;
  agency_timezone: string;
  agency_email: string;
}

export interface Signal {
  signal_id: string;
  agency_id: string;
  latitude: number;
  longitude: number;
}

export interface Approach {
  approach_id: string;
  signal_id: string;
  street_name: string;
  compass_bearing: number;
  posted_speed: number;
  // e.g. "0" (no free right), "1-FR", "1-FR-P", "1-FR-PI"
  free_right: string;
}

export interface Phase {
  phase: string;
  approach_id: string;
  signal_id: string;
  movement_type: MovementType;
  num_of_lanes: number;
  pedX: PedX;
  // e.g. "LE-25", "TE-20", or a raw measured value like "22"
  crosswalk_length: string;
}

export interface Detector {
  channel: string;
  signal_id: string;
  phase: string;
  description: string;
  purpose: DetectorPurpose;
  vehicle_type: DetectorVehicleType;
  lane: number;
  technology_type: DetectorTechnology;
  mode: DetectorMode;
  length: number;
  stopbar_setback_dist: number;
}

export interface BasicTiming {
  phase: string;
  signal_id: string;
  ped_walk: number;
  ped_clearance: number;
  leading_ped_interval: number;
  min_green: number;
  max_green: number;
  yellow: number;
  all_red: number;
  veh_recall_type: VehRecallType;
  ped_recall: boolean;
}

// A full GTSS feed for a single intersection (signal_id).
export interface GtssFeed {
  signalId: string;
  agency: Agency;
  signals: Signal[];
  approaches: Approach[];
  phases: Phase[];
  detectors: Detector[];
  basicTimings: BasicTiming[];
}
