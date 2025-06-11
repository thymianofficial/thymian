import { SerializationStyleBuilder } from './serialization-style.js';

export class PathSerializationStyleBuilder extends SerializationStyleBuilder<
  'simple' | 'label' | 'matrix'
> {
  constructor() {
    super('simple', false);
  }
}
