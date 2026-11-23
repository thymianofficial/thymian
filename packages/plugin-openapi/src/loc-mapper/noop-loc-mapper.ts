import type { LocMapper } from './loc-mapper.js';

export class NoopLocMapper implements LocMapper {
  locationForOperation(): undefined {
    return undefined;
  }
}
