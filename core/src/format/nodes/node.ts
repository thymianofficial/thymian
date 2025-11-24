import type { ThymianFormatLocation } from '../format-location.js';

export interface ThymianBaseNode {
  type: string;
  label: string;
  extensions?: Record<PropertyKey, unknown>;
  location?: ThymianFormatLocation;
}
