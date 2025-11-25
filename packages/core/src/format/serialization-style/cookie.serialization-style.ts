import { SerializationStyleBuilder } from './serialization-style.js';

export class CookieSerializationStyleBuilder extends SerializationStyleBuilder<'form'> {
  constructor() {
    super('form', true);
  }
}
