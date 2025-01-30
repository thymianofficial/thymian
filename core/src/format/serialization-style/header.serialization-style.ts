import { SerializationStyle } from './serialization-style.js';

export class HeaderSerializationStyle extends SerializationStyle<'simple'> {
  constructor() {
    super('simple', false);
  }
}
