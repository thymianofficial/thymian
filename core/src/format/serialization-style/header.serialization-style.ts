import { SerializationStyleBuilder } from './serialization-style.js';

export class HeaderSerializationStyleBuilder extends SerializationStyleBuilder<'simple'> {
  constructor() {
    super('simple', false);
  }
}
