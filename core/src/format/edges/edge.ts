import type { ThymianFormatLocation } from '../format-location.js';

export interface ThymianBaseEdge {
  type: string;
  label: string;
  extensions?: Record<PropertyKey, unknown>;
  location?: ThymianFormatLocation;
}
