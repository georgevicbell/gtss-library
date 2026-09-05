import type { Agency, Approach, BasicTiming, Detector, Phase, Signal } from './types';

function escapeCsvValue(value: string | number | boolean): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv<T>(headers: (keyof T)[], rows: T[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvValue(row[h] as unknown as string | number | boolean)).join(','));
  }
  // GTFS/GTSS-style txt files end with a trailing newline.
  return lines.join('\n') + '\n';
}

export function agencyToCsv(agency: Agency): string {
  return toCsv<Agency>(
    ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_email'],
    [agency]
  );
}

export function signalsToCsv(signals: Signal[]): string {
  return toCsv<Signal>(['signal_id', 'agency_id', 'latitude', 'longitude'], signals);
}

export function approachesToCsv(approaches: Approach[]): string {
  return toCsv<Approach>(
    ['approach_id', 'signal_id', 'street_name', 'compass_bearing', 'posted_speed', 'free_right'],
    approaches
  );
}

export function phasesToCsv(phases: Phase[]): string {
  return toCsv<Phase>(
    ['phase', 'approach_id', 'signal_id', 'movement_type', 'num_of_lanes', 'pedX', 'crosswalk_length'],
    phases
  );
}

export function detectorsToCsv(detectors: Detector[]): string {
  return toCsv<Detector>(
    [
      'channel',
      'signal_id',
      'phase',
      'description',
      'purpose',
      'vehicle_type',
      'lane',
      'technology_type',
      'mode',
      'length',
      'stopbar_setback_dist',
    ],
    detectors
  );
}

export function basicTimingsToCsv(timings: BasicTiming[]): string {
  return toCsv<BasicTiming>(
    [
      'phase',
      'signal_id',
      'ped_walk',
      'ped_clearance',
      'leading_ped_interval',
      'min_green',
      'max_green',
      'yellow',
      'all_red',
      'veh_recall_type',
      'ped_recall',
    ],
    timings
  );
}
