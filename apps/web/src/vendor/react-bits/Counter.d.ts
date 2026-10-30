import type { CSSProperties, ReactElement } from 'react';

/** Typed surface for the vendored (untyped) React Bits `Counter`. */
export interface CounterProps {
  value?: number;
  locale?: string;
  format?: Intl.NumberFormatOptions;
  decimals?: number;
  minDigits?: number;
  prefix?: string;
  suffix?: string;
  direction?: 'auto' | 'up' | 'down' | 'shortest';
  duration?: number;
  bounce?: number;
  stagger?: number;
  motionBlur?: boolean;
  intro?: boolean;
  fade?: number;
  fontSize?: number;
  fontWeight?: string | number;
  textColor?: string;
  gap?: number;
  padding?: number;
  tabular?: boolean;
  digitStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
}

export default function Counter(props: CounterProps): ReactElement;
