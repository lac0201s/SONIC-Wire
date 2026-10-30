import type { CSSProperties, ReactElement } from 'react';

export type StatusMarkStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

/** Typed surface for the vendored (untyped) React Bits `StatusMark`. */
export interface StatusMarkProps {
  status?: StatusMarkStatus;
  progress?: number;
  label?: string;
  color?: string;
  doneColor?: string;
  errorColor?: string;
  size?: number;
  strokeWidth?: number;
  dashes?: number;
  fontSize?: number;
  spinDuration?: number;
  arcLength?: number;
  drawDuration?: number;
  fillOpacity?: number;
  strike?: boolean;
  strikeDelay?: number;
  className?: string;
  style?: CSSProperties;
}

export default function StatusMark(props: StatusMarkProps): ReactElement;
