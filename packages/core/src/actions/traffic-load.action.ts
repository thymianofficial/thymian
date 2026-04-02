import type { JSONSchemaType } from 'ajv/dist/2020.js';

import type { LoadedTraffic } from '../rules/traffic.js';
import type { Action } from './action.js';

export interface TrafficInput {
  type: string;
  location: unknown;
  options?: Record<string, unknown>;
}

export interface CoreTrafficLoadInput {
  inputs: TrafficInput[];
  options?: Record<string, unknown>;
}

export type TrafficLoadAction = Action<CoreTrafficLoadInput, LoadedTraffic>;

export const trafficInputSchema = {
  type: 'object',
  nullable: false,
  required: ['type', 'location'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', nullable: false },
    location: {},
    options: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<TrafficInput>;

export const trafficLoadActionSchema = {
  type: 'object',
  nullable: false,
  required: ['inputs'],
  additionalProperties: false,
  properties: {
    inputs: {
      type: 'array',
      nullable: false,
      items: trafficInputSchema,
    },
    options: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: true,
    },
  },
} as unknown as JSONSchemaType<CoreTrafficLoadInput>;
