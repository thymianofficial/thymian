import { SerializationStyleBuilder } from './serialization-style.js';

export class QuerySerializationStyleBuilder extends SerializationStyleBuilder<
  'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject'
> {
  constructor() {
    super('form', true);
  }
}
