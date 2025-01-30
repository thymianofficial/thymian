import { SerializationStyle } from './serialization-style.js';

export class CookieSerializationStyle extends SerializationStyle<'form'> {
  constructor() {
    super('form', true);
  }
}
