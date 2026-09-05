import * as React from 'react';
import Svg, { Circle, Defs, G, Line, Marker, Path, Polygon, Rect, Text, TSpan } from 'react-native-svg';

import { freeRightPedMarkings } from './free-right-markings';

// react-native-svg's Defs type omits its children prop even though it renders them; cast to unblock JSX.
const DefsAny = Defs as unknown as React.ComponentType<{ children?: React.ReactNode }>;

// Phase intersection diagram, ported from the official GTSS-Signal-Builder app
// (client/src/components/gtss/phase-diagram-svg.tsx), rendered with react-native-svg
// so it works identically on web and native.

// Phase colors by phase number.
export const phaseColors: Record<number, string> = {
  1: '#22c55e', // green
  2: '#3b82f6', // blue
  3: '#f97316', // orange
  4: '#8b5cf6', // purple
  5: '#ef4444', // red
  6: '#14b8a6', // teal
  7: '#eab308', // yellow
  8: '#ec4899', // pink
};

export interface PhaseDiagramPhase {
  phase: number;
  approachId: string | null;
  movementType: string;
  /** Pedestrian crossing mode 0-7, see renderPedestrianLine for the meaning of each value. */
  isPedestrian?: boolean | number | null;
}

export interface PhaseDiagramApproach {
  approachId: string;
  compassBearing: number | null;
  streetName?: string;
  /** 0 = none, 1 = FR, 2 = FR-P, 3 = FR-P-I. */
  freeRight?: boolean | number | null;
  freeRightLanes?: number | null;
}

export interface PhaseDiagramProps {
  phases: PhaseDiagramPhase[];
  approaches: PhaseDiagramApproach[];
  intersectionName?: string;
  intersectionId?: string;
}

// Fallback palette for streets that don't have any phase assigned yet.
const STREET_PALETTE = ['#0ea5e9', '#f59e0b', '#16a34a', '#db2777', '#7c3aed', '#0d9488'];

const HEADER_MAX_WIDTH = 320; // viewBox is 340 wide - leave a small margin
const TITLE_FONT = 14;
const TITLE_LINE_H = 16;
const STREET_FONT = 12;
const STREET_LINE_H = 14;

const estTextWidth = (text: string, fontSize: number) => text.length * fontSize * 0.58;

const wrapWords = (text: string, fontSize: number, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (current && estTextWidth(candidate, fontSize) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
};

const packStreets = (names: string[], fontSize: number, maxWidth: number): string[][] => {
  if (names.length === 0) return [];
  const separatorWidth = estTextWidth(' \u00b7 ', fontSize);
  const lines: string[][] = [];
  let current: string[] = [];
  let currentWidth = 0;
  names.forEach((name) => {
    const width = estTextWidth(name, fontSize);
    const added = current.length > 0 ? separatorWidth + width : width;
    if (current.length > 0 && currentWidth + added > maxWidth) {
      lines.push(current);
      current = [name];
      currentWidth = width;
    } else {
      current.push(name);
      currentWidth += added;
    }
  });
  if (current.length > 0) lines.push(current);
  return lines;
};

export default function PhaseDiagram({ phases, approaches, intersectionName, intersectionId }: PhaseDiagramProps) {
  const uniqueStreets = Array.from(new Set(approaches.map((a) => (a.streetName || '').trim()).filter(Boolean)));

  const colorForStreet = (street: string, fallbackIndex: number): string => {
    const approachIds = approaches.filter((a) => (a.streetName || '').trim() === street).map((a) => a.approachId);
    const streetPhases = phases.filter(
      (p) => p.approachId != null && approachIds.includes(p.approachId) && p.movementType !== 'Pedestrian'
    );
    if (streetPhases.length > 0) {
      const through = streetPhases.filter((p) => p.movementType === 'Through' || p.movementType === 'Through-Right');
      const pool = through.length > 0 ? through : streetPhases;
      const rep = pool.reduce((min, p) => (p.phase < min.phase ? p : min), pool[0]);
      return phaseColors[rep.phase] || STREET_PALETTE[fallbackIndex % STREET_PALETTE.length];
    }
    return STREET_PALETTE[fallbackIndex % STREET_PALETTE.length];
  };

  const getApproachBearing = (approachId: string | null): number | null => {
    if (!approachId) return null;
    const approach = approaches.find((a) => a.approachId === approachId);
    return approach?.compassBearing ?? null;
  };

  const getMovementType = (
    movementType: string
  ): 'straight' | 'left' | 'right' | 'uturn' | 'pedestrian' | 'leftThrough' | 'permissive' => {
    switch (movementType) {
      case 'Left Turn':
      case 'Left Protected-Permissive':
      case 'Flashing Yellow Arrow':
        return 'left';
      case 'Left Through Shared':
        return 'leftThrough';
      case 'Permissive Phase':
        return 'permissive';
      case 'Right Turn':
        return 'right';
      case 'U-Turn':
        return 'uturn';
      case 'Pedestrian':
        return 'pedestrian';
      default:
        return 'straight';
    }
  };

  // With 180deg bearing adjustment, perpAngle points LEFT, so positive = left.
  const getPhaseOffset = (phase: PhaseDiagramPhase): number => {
    const sameApproachPhases = phases.filter((p) => p.approachId === phase.approachId);
    const moveType = getMovementType(phase.movementType);

    let baseOffset = 0;
    if (moveType === 'left') baseOffset = 7;
    else if (moveType === 'right') baseOffset = -18;
    else if (moveType === 'straight') baseOffset = -7;

    const sameTypeCount = sameApproachPhases.filter((p) => getMovementType(p.movementType) === moveType);
    const typeIndex = sameTypeCount.findIndex((p) => p.phase === phase.phase);
    if (sameTypeCount.length > 1) {
      baseOffset += (typeIndex - (sameTypeCount.length - 1) / 2) * 8;
    }

    return baseOffset;
  };

  // Diagonal pedestrian crossings (modes 4, 5, 6) are sized so their endpoints fall on this circle.
  const CENTER_RADIUS = 42;

  const pedMode = (phase: PhaseDiagramPhase): number => {
    if (typeof phase.isPedestrian === 'number') return phase.isPedestrian;
    return phase.isPedestrian ? 1 : 0;
  };

  const crosswalkDashAt = (bearing: number, color: string, key: string) => {
    const angleRad = (bearing - 90) * (Math.PI / 180);
    const perpAngle = angleRad + Math.PI / 2;
    const offsetDistance = 20;
    const centerX = 150 + offsetDistance * Math.cos(perpAngle);
    const centerY = 150 + offsetDistance * Math.sin(perpAngle);
    const lineHalfLength = 38;
    const x1 = centerX + lineHalfLength * Math.cos(angleRad);
    const y1 = centerY + lineHalfLength * Math.sin(angleRad);
    const x2 = centerX - lineHalfLength * Math.cos(angleRad);
    const y2 = centerY - lineHalfLength * Math.sin(angleRad);
    return (
      <Line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeDasharray="4 3" opacity={0.7} />
    );
  };

  // Pedestrian crossing modes:
  //   0 = none, 1 = on assigned approach, 2 = assigned+opposite, 3 = opposite only,
  //   4 = diagonal "\", 5 = diagonal "/", 6 = both diagonals ("X"), 7 = full scramble.
  const renderPedestrianLine = (phase: PhaseDiagramPhase, index: number) => {
    const mode = pedMode(phase);
    if (mode === 0) return null;
    const bearing = getApproachBearing(phase.approachId);
    if (bearing === null) return null;
    const color = phaseColors[phase.phase] || '#6b7280';

    if (mode === 1) return crosswalkDashAt(bearing, color, `ped-${index}-near`);
    if (mode === 2) {
      return (
        <G key={`ped-${index}`}>
          {crosswalkDashAt(bearing, color, `ped-${index}-near`)}
          {crosswalkDashAt((bearing + 180) % 360, color, `ped-${index}-far`)}
        </G>
      );
    }
    if (mode === 3) return crosswalkDashAt((bearing + 180) % 360, color, `ped-${index}-far`);

    const d = CENTER_RADIUS / Math.SQRT2;
    const diagonal = (dir: 1 | -1, key: string) => (
      <Line
        key={key}
        x1={150 - d * dir}
        y1={150 - d}
        x2={150 + d * dir}
        y2={150 + d}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="5 4"
        opacity={0.7}
      />
    );

    if (mode === 6) {
      return (
        <G key={`ped-${index}`}>
          {diagonal(1, `ped-${index}-d1`)}
          {diagonal(-1, `ped-${index}-d2`)}
        </G>
      );
    }
    if (mode === 7) {
      return (
        <G key={`ped-${index}`}>
          {crosswalkDashAt(bearing, color, `ped-${index}-n`)}
          {crosswalkDashAt((bearing + 90) % 360, color, `ped-${index}-e`)}
          {crosswalkDashAt((bearing + 180) % 360, color, `ped-${index}-s`)}
          {crosswalkDashAt((bearing + 270) % 360, color, `ped-${index}-w`)}
          {diagonal(1, `ped-${index}-d1`)}
          {diagonal(-1, `ped-${index}-d2`)}
        </G>
      );
    }

    return diagonal(mode === 4 ? 1 : -1, `ped-${index}`);
  };

  // Every endpoint of every crossing this phase draws, in diagram coords (mirrors renderPedestrianLine's geometry).
  const pedCrossingEndpoints = (phase: PhaseDiagramPhase): Array<[number, number]> => {
    const mode = pedMode(phase);
    const bearing = getApproachBearing(phase.approachId);
    if (mode === 0 || bearing === null) return [];

    const dashEnds = (b: number): Array<[number, number]> => {
      const angleRad = (b - 90) * (Math.PI / 180);
      const perpAngle = angleRad + Math.PI / 2;
      const cx = 150 + 20 * Math.cos(perpAngle);
      const cy = 150 + 20 * Math.sin(perpAngle);
      const half = 38;
      return [
        [cx + half * Math.cos(angleRad), cy + half * Math.sin(angleRad)],
        [cx - half * Math.cos(angleRad), cy - half * Math.sin(angleRad)],
      ];
    };
    const d = CENTER_RADIUS / Math.SQRT2;
    const diagEnds = (dir: 1 | -1): Array<[number, number]> => [
      [150 - d * dir, 150 - d],
      [150 + d * dir, 150 + d],
    ];

    switch (mode) {
      case 1:
        return dashEnds(bearing);
      case 2:
        return [...dashEnds(bearing), ...dashEnds((bearing + 180) % 360)];
      case 3:
        return dashEnds((bearing + 180) % 360);
      case 4:
        return diagEnds(1);
      case 5:
        return diagEnds(-1);
      case 6:
        return [...diagEnds(1), ...diagEnds(-1)];
      case 7:
        return [
          ...dashEnds(bearing),
          ...dashEnds((bearing + 90) % 360),
          ...dashEnds((bearing + 180) % 360),
          ...dashEnds((bearing + 270) % 360),
          ...diagEnds(1),
          ...diagEnds(-1),
        ];
      default:
        return [];
    }
  };

  const renderArrow = (phase: PhaseDiagramPhase, index: number) => {
    const bearing = getApproachBearing(phase.approachId);
    if (bearing === null) return null;

    const moveType = getMovementType(phase.movementType);
    if (moveType === 'pedestrian') return null;

    const color = phaseColors[phase.phase] || '#6b7280';
    const strokeWidth = 3;

    const adjustedBearing = (bearing + 180) % 360;
    const angleRad = (adjustedBearing - 90) * (Math.PI / 180);
    const perpAngle = angleRad + Math.PI / 2;
    const outerRadius = 105;
    const innerRadius = 48;
    const lateralOffset = getPhaseOffset(phase);
    const offsetX = lateralOffset * Math.cos(perpAngle);
    const offsetY = lateralOffset * Math.sin(perpAngle);
    const startX = 150 + outerRadius * Math.cos(angleRad) + offsetX;
    const startY = 150 + outerRadius * Math.sin(angleRad) + offsetY;
    const endX = 150 + innerRadius * Math.cos(angleRad) + offsetX;
    const endY = 150 + innerRadius * Math.sin(angleRad) + offsetY;

    if (moveType === 'left') {
      const bendPoint = 0.4;
      const bendX = startX + (endX - startX) * (1 - bendPoint);
      const bendY = startY + (endY - startY) * (1 - bendPoint);
      const tipLength = 22;
      const leftPerpAngle = angleRad + Math.PI / 2;
      const tipX = bendX + tipLength * Math.cos(leftPerpAngle);
      const tipY = bendY + tipLength * Math.sin(leftPerpAngle);

      const isLpp = phase.movementType === 'Left Protected-Permissive';
      const isFya = phase.movementType === 'Flashing Yellow Arrow';

      return (
        <G key={index}>
          <Line
            x1={startX}
            y1={startY}
            x2={bendX}
            y2={bendY}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={isLpp ? '6 5' : undefined}
          />
          <Line
            x1={bendX}
            y1={bendY}
            x2={tipX}
            y2={tipY}
            stroke={isFya ? '#eab308' : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={isLpp ? '6 5' : isFya ? '4 4' : undefined}
            markerEnd={isFya ? 'url(#arrowhead-fya)' : `url(#arrowhead-${phase.phase})`}
          />
        </G>
      );
    }

    if (moveType === 'right') {
      const bendPoint = 0.4;
      const bendX = startX + (endX - startX) * (1 - bendPoint);
      const bendY = startY + (endY - startY) * (1 - bendPoint);
      const tipLength = 22;
      const rightPerpAngle = angleRad - Math.PI / 2;
      const tipX = bendX + tipLength * Math.cos(rightPerpAngle);
      const tipY = bendY + tipLength * Math.sin(rightPerpAngle);

      return (
        <G key={index}>
          <Line x1={startX} y1={startY} x2={bendX} y2={bendY} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line
            x1={bendX}
            y1={bendY}
            x2={tipX}
            y2={tipY}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            markerEnd={`url(#arrowhead-${phase.phase})`}
          />
        </G>
      );
    }

    if (moveType === 'uturn') {
      const leftPerpAngle = angleRad + Math.PI / 2;
      const backAngle = angleRad + Math.PI;
      const stemEndX = startX + (endX - startX) * 0.7;
      const stemEndY = startY + (endY - startY) * 0.7;
      const hookOffset = 12;
      const hookX = stemEndX + hookOffset * Math.cos(leftPerpAngle);
      const hookY = stemEndY + hookOffset * Math.sin(leftPerpAngle);
      const arrowLength = 16;
      const arrowStartX = hookX - 12 * Math.cos(backAngle);
      const arrowStartY = hookY - 12 * Math.sin(backAngle);
      const arrowEndX = arrowStartX + arrowLength * Math.cos(backAngle);
      const arrowEndY = arrowStartY + arrowLength * Math.sin(backAngle);

      return (
        <G key={index}>
          <Line x1={startX} y1={startY} x2={stemEndX} y2={stemEndY} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line x1={stemEndX} y1={stemEndY} x2={arrowStartX} y2={arrowStartY} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line
            x1={arrowEndX}
            y1={arrowEndY}
            x2={arrowStartX}
            y2={arrowStartY}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            markerEnd={`url(#arrowhead-${phase.phase})`}
          />
        </G>
      );
    }

    if (moveType === 'leftThrough') {
      const leftPerpAngle = angleRad + Math.PI / 2;
      const splitX = startX + (endX - startX) * 0.65;
      const splitY = startY + (endY - startY) * 0.65;
      const leftTipLength = 20;
      const leftTipX = splitX + leftTipLength * Math.cos(leftPerpAngle);
      const leftTipY = splitY + leftTipLength * Math.sin(leftPerpAngle);

      return (
        <G key={index}>
          <Line x1={startX} y1={startY} x2={splitX} y2={splitY} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          <Line
            x1={splitX}
            y1={splitY}
            x2={endX}
            y2={endY}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            markerEnd={`url(#arrowhead-${phase.phase})`}
          />
          <Line
            x1={splitX}
            y1={splitY}
            x2={leftTipX}
            y2={leftTipY}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            markerEnd={`url(#arrowhead-${phase.phase})`}
          />
        </G>
      );
    }

    if (moveType === 'permissive') {
      const leftPerpAngle = angleRad + Math.PI / 2;
      const splitX = startX + (endX - startX) * 0.65;
      const splitY = startY + (endY - startY) * 0.65;
      const leftTipLength = 20;
      const leftTipX = splitX + leftTipLength * Math.cos(leftPerpAngle);
      const leftTipY = splitY + leftTipLength * Math.sin(leftPerpAngle);

      return (
        <G key={index}>
          <Line
            x1={splitX}
            y1={splitY}
            x2={leftTipX}
            y2={leftTipY}
            stroke="#9ca3af"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            markerEnd="url(#arrowhead-grey)"
          />
          <Line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            markerEnd={`url(#arrowhead-${phase.phase})`}
          />
        </G>
      );
    }

    // Straight (Through, Through-Right)
    return (
      <Line
        key={index}
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd={`url(#arrowhead-${phase.phase})`}
      />
    );
  };

  const renderLabel = (phase: PhaseDiagramPhase, index: number) => {
    const bearing = getApproachBearing(phase.approachId);
    if (bearing === null) return null;

    const adjustedBearing = (bearing + 180) % 360;
    const angleRad = (adjustedBearing - 90) * (Math.PI / 180);
    const perpAngle = angleRad + Math.PI / 2;
    const lateralOffset = getPhaseOffset(phase);
    const offsetX = lateralOffset * Math.cos(perpAngle);
    const offsetY = lateralOffset * Math.sin(perpAngle);
    const labelRadius = 135;
    const labelX = 150 + labelRadius * Math.cos(angleRad) + offsetX;
    const labelY = 150 + labelRadius * Math.sin(angleRad) + offsetY;
    const color = phaseColors[phase.phase] || '#6b7280';

    return (
      <Text key={`label-${index}`} x={labelX} y={labelY + 4} textAnchor="middle" fontSize={14} fontWeight="bold" fill={color}>
        {phase.phase}
      </Text>
    );
  };

  // Place one badge per pedestrian-only phase, pinned beside a crossing it actually draws.
  const legAngles = approaches
    .filter((a) => a.compassBearing !== null)
    .map((a) => ((((a.compassBearing as number) + 180) % 360) - 90) * (Math.PI / 180));

  const angDist = (a: number, b: number) => {
    const diff = Math.abs(a - b) % (2 * Math.PI);
    return diff > Math.PI ? 2 * Math.PI - diff : diff;
  };

  const pedBadges: Array<{ key: string; phase: number; x: number; y: number }> = [];
  {
    const placed: Array<{ angle: number; radius: number }> = [];
    const unanchored: Array<{ key: string; phase: number }> = [];
    phases.forEach((phase, idx) => {
      if (phase.movementType !== 'Pedestrian') return;
      const ends = pedCrossingEndpoints(phase);
      if (ends.length === 0) {
        unanchored.push({ key: `ped-badge-${idx}`, phase: phase.phase });
        return;
      }
      let bestAngle = 0;
      let bestRadius = CENTER_RADIUS;
      let bestScore = -Infinity;
      ends.forEach(([x, y]) => {
        const angle = Math.atan2(y - 150, x - 150);
        const legClear = legAngles.length > 0 ? Math.min(...legAngles.map((l) => angDist(angle, l))) : Math.PI / 2;
        const badgeClear = placed.length > 0 ? Math.min(...placed.map((pl) => angDist(angle, pl.angle))) : Math.PI / 2;
        const score = Math.min(legClear, Math.PI / 2) + Math.min(badgeClear, 0.6);
        if (score > bestScore) {
          bestScore = score;
          bestAngle = angle;
          bestRadius = Math.hypot(x - 150, y - 150);
        }
      });
      let radius = bestRadius + 16;
      while (placed.some((pl) => angDist(bestAngle, pl.angle) < 0.35 && Math.abs(radius - pl.radius) < 18)) {
        radius += 19;
      }
      placed.push({ angle: bestAngle, radius });
      pedBadges.push({
        key: `ped-badge-${idx}`,
        phase: phase.phase,
        x: 150 + radius * Math.cos(bestAngle),
        y: 150 + radius * Math.sin(bestAngle),
      });
    });
    unanchored.forEach((badge, i) => {
      pedBadges.push({ ...badge, x: 150 + (i - (unanchored.length - 1) / 2) * 34, y: 306 });
    });
  }

  const titleLines = intersectionName ? wrapWords(intersectionName, TITLE_FONT, HEADER_MAX_WIDTH) : [];
  const streetLines = packStreets(uniqueStreets, STREET_FONT, HEADER_MAX_WIDTH);
  const titleExtra = Math.max(0, titleLines.length - 1) * TITLE_LINE_H;
  const streetExtra = Math.max(0, streetLines.length - 1) * STREET_LINE_H;
  const streetTop = 35 + titleExtra;
  const diagramTop = 42 + titleExtra + streetExtra;
  const canvasHeight = 384 + titleExtra + streetExtra;

  return (
    <Svg viewBox={`-20 0 340 ${canvasHeight}`} width="100%" height={canvasHeight}>
      <DefsAny>
        <>
          {Object.entries(phaseColors).map(([phase, color]) => (
            <Marker key={phase} id={`arrowhead-${phase}`} markerWidth={6} markerHeight={5} refX={5} refY={2.5} orient="auto">
              <Polygon points="0 0, 6 2.5, 0 5" fill={color} />
            </Marker>
          ))}
          <Marker id="arrowhead-grey" markerWidth={6} markerHeight={5} refX={5} refY={2.5} orient="auto">
            <Polygon points="0 0, 6 2.5, 0 5" fill="#9ca3af" />
          </Marker>
          <Marker id="arrowhead-fya" markerWidth={6} markerHeight={5} refX={5} refY={2.5} orient="auto">
            <Polygon points="0 0, 6 2.5, 0 5" fill="#eab308" />
          </Marker>
        </>
      </DefsAny>

      {titleLines.map((line, i) => (
        <Text key={`title-${i}`} x={150} y={16 + i * TITLE_LINE_H} textAnchor="middle" fontSize={TITLE_FONT} fontWeight="bold" fill="#374151">
          {line}
        </Text>
      ))}

      {streetLines.map((lineNames, lineIdx) => (
        <Text key={`streets-${lineIdx}`} x={150} y={streetTop + lineIdx * STREET_LINE_H} textAnchor="middle" fontSize={STREET_FONT} fontWeight="700">
          {lineNames.map((name, i) => (
            <TSpan key={`street-${lineIdx}-${i}`}>
              {i > 0 ? <TSpan fill="#9ca3af"> {'\u00b7'} </TSpan> : <TSpan />}
              <TSpan fill={colorForStreet(name, uniqueStreets.indexOf(name))}>{name}</TSpan>
            </TSpan>
          ))}
        </Text>
      ))}

      <G transform={`translate(0, ${diagramTop})`}>
        <Circle cx={150} cy={150} r={115} fill="none" stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
        <Circle cx={150} cy={150} r={42} fill="#f3f4f6" stroke="#d1d5db" strokeWidth={2} />

        <Text x={150} y={22} textAnchor="middle" fontSize={11} fill="#9ca3af">N</Text>
        <Text x={280} y={154} textAnchor="middle" fontSize={11} fill="#9ca3af">E</Text>
        <Text x={150} y={288} textAnchor="middle" fontSize={11} fill="#9ca3af">S</Text>
        <Text x={20} y={154} textAnchor="middle" fontSize={11} fill="#9ca3af">W</Text>

        {approaches.map((approach, idx) => {
          if (approach.compassBearing === null) return null;
          const adjustedBearing = (approach.compassBearing + 180) % 360;
          const angleRad = (adjustedBearing - 90) * (Math.PI / 180);
          const outerX = 150 + 115 * Math.cos(angleRad);
          const outerY = 150 + 115 * Math.sin(angleRad);
          const innerX = 150 + 44 * Math.cos(angleRad);
          const innerY = 150 + 44 * Math.sin(angleRad);
          return <Line key={idx} x1={outerX} y1={outerY} x2={innerX} y2={innerY} stroke="#e5e7eb" strokeWidth={20} strokeLinecap="butt" />;
        })}

        {/* FR - free right slip lanes peeling off toward the neighboring approach's real bearing. */}
        {approaches.map((approach, idx) => {
          const frMode = typeof approach.freeRight === 'number' ? approach.freeRight : approach.freeRight ? 1 : 0;
          if (frMode === 0 || approach.compassBearing === null) return null;
          const adjustedBearing = (approach.compassBearing + 180) % 360;
          const angleRad = (adjustedBearing - 90) * (Math.PI / 180);
          const rightGaps = approaches
            .filter((o) => o !== approach && o.compassBearing !== null)
            .map((o) => {
              const oRad = ((((o.compassBearing as number) + 180) % 360) - 90) * (Math.PI / 180);
              const gap = (angleRad - oRad) % (2 * Math.PI);
              return gap < 0 ? gap + 2 * Math.PI : gap;
            })
            .filter((gap) => gap > 0.17 && gap < Math.PI - 0.17);
          const sweep = rightGaps.length > 0 ? Math.min(...rightGaps) : Math.PI / 2;
          const exitRad = angleRad - sweep;
          const midRad = angleRad - sweep / 2;
          const p = (r: number, a: number): [number, number] => [150 + r * Math.cos(a), 150 + r * Math.sin(a)];
          const d = 98;
          const h = sweep / 2;
          const flatR = 1.35 * d * Math.tan(h);
          const flatMid = d * Math.cos(h) + Math.sqrt(Math.max(flatR * flatR - (d * Math.sin(h)) ** 2, 0)) - flatR;
          const clear = Math.max(50, flatMid);
          const sag = d * Math.cos(h) - clear;
          const [sx, sy] = p(d, angleRad);
          const [ex, ey] = p(d, exitRad);
          const path =
            Math.abs(sag) < 0.5
              ? `M ${sx} ${sy} L ${ex} ${ey}`
              : (() => {
                  const R = ((d * Math.sin(h)) ** 2 + sag * sag) / (2 * Math.abs(sag));
                  return `M ${sx} ${sy} A ${R} ${R} 0 0 ${sag > 0 ? 1 : 0} ${ex} ${ey}`;
                })();
          const [mcx, mcy] = p(clear, midRad);
          const frLanes = Math.max(1, approach.freeRightLanes ?? 1);
          const roadWidth = 10 + (frLanes - 1) * 6;
          return (
            <G key={`fr-${idx}`}>
              <Path d={path} fill="none" stroke="#e5e7eb" strokeWidth={roadWidth} strokeLinecap="butt" />
              <Path d={path} fill="none" stroke="#9ca3af" strokeWidth={1.25} strokeDasharray="3 3" />
              {freeRightPedMarkings(frMode, { keyPrefix: `fr-mark-${idx}`, cx: mcx, cy: mcy, midRad, halfWidth: roadWidth / 2 + 2, scale: 1 })}
            </G>
          );
        })}

        {phases.map((phase, idx) => renderPedestrianLine(phase, idx))}
        {phases.map((phase, idx) => renderArrow(phase, idx))}

        {intersectionId &&
          (() => {
            const maxWidth = 70;
            const fontSize = Math.max(10, Math.min(38, maxWidth / (intersectionId.length * 0.62)));
            return (
              <Text x={150} y={150 + fontSize * 0.34} textAnchor="middle" fontSize={fontSize} fontWeight="bold" fill="#6b7280">
                {intersectionId}
              </Text>
            );
          })()}

        {phases.filter((p) => p.movementType !== 'Pedestrian').map((phase, idx) => renderLabel(phase, idx))}

        {pedBadges.map((badge) => {
          const label = `P${badge.phase}`;
          const width = 11 + label.length * 6.5;
          const color = phaseColors[badge.phase] || '#6b7280';
          return (
            <G key={badge.key}>
              <Rect x={badge.x - width / 2} y={badge.y - 8} width={width} height={16} rx={8} fill={color} stroke="#ffffff" strokeWidth={1.5} />
              <Text x={badge.x} y={badge.y + 4} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#ffffff">
                {label}
              </Text>
            </G>
          );
        })}
      </G>
    </Svg>
  );
}
