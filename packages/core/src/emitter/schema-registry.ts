import { ajv, type JSONSchemaType, validate } from '../ajv.js';
import type { ThymianPlugin } from '../thymian-plugin.js';
import {
  probe,
  type SerializabilityViolation,
} from './serializability-probe.js';

export type PayloadCheck =
  | { ok: true }
  | {
      ok: false;
      reason: 'not-serializable';
      violations: SerializabilityViolation[];
    }
  | { ok: false; reason: 'schema-mismatch'; details: string };

export type PayloadKind = 'event' | 'action.event' | 'action.response';

export class SchemaRegistry {
  readonly #event = new Map<string, JSONSchemaType<unknown>>();
  readonly #actionEvent = new Map<string, JSONSchemaType<unknown>>();
  readonly #actionResponse = new Map<string, JSONSchemaType<unknown>>();

  register<T extends Record<PropertyKey, unknown>>(
    plugin: ThymianPlugin<T>,
  ): void {
    const events = plugin.events?.provides ?? {};
    for (const [name, schema] of Object.entries(events)) {
      if (schema) {
        this.#event.set(name, schema as JSONSchemaType<unknown>);
      }
    }

    const actions = plugin.actions?.provides ?? {};
    for (const [name, schemas] of Object.entries(actions)) {
      if (!schemas) {
        continue;
      }
      this.#actionEvent.set(name, schemas.event as JSONSchemaType<unknown>);
      this.#actionResponse.set(
        name,
        schemas.response as JSONSchemaType<unknown>,
      );
    }
  }

  has(name: string, kind: PayloadKind): boolean {
    return this.#map(kind).has(name);
  }

  check(name: string, kind: PayloadKind, payload: unknown): PayloadCheck {
    const serial = probe(payload);
    if (!serial.ok) {
      return {
        ok: false,
        reason: 'not-serializable',
        violations: serial.violations,
      };
    }

    const schema = this.#map(kind).get(name);
    if (!schema) {
      return { ok: true };
    }

    if (!validate(schema, payload)) {
      return {
        ok: false,
        reason: 'schema-mismatch',
        details: `payload does not match ${kind} schema for "${name}": ${ajv.errorsText(ajv.errors)}`,
      };
    }

    return { ok: true };
  }

  #map(kind: PayloadKind): Map<string, JSONSchemaType<unknown>> {
    switch (kind) {
      case 'event':
        return this.#event;
      case 'action.event':
        return this.#actionEvent;
      case 'action.response':
        return this.#actionResponse;
    }
  }
}
