import { SerializationStyle } from './serialization-style.js';

export class PathSerializationStyle extends SerializationStyle<
  'simple' | 'label' | 'matrix'
> {
  constructor() {
    super('simple', false);
  }
}
