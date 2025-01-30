import { SerializationStyle } from './serialization-style.js';

export class QuerySerializationStyle extends SerializationStyle<
  'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject'
> {
  override style: 'form' | 'spaceDelimited' | 'pipeDelimited' | 'deepObject' =
    'form';

  constructor() {
    super('form', true);
  }
}
