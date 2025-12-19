import type { ThymianFormatLocation } from '../format-location.js';

export interface ThymianBaseEdge {
  type: string;
  label: string;
  extensions?: Record<PropertyKey, unknown>;
  sourceLocation?: ThymianFormatLocation;
  sourceName: string;
}
