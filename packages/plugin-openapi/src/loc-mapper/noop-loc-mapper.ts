import { LocMapper } from './loc-mapper.js';

export class NoopLocMapper extends LocMapper {
  constructor() {
    super('', '');
  }

  positionForOperationId(): undefined {
    return undefined;
  }
}
