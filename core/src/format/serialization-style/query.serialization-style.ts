import { SerializationStyleBuilder } from './serialization-style.js';

export class QuerySerializationStyleBuilder extends SerializationStyleBuilder<
  'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject'
> {
  override style: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject' =
    'form';

  constructor() {
    super('form', true);
  }
}
