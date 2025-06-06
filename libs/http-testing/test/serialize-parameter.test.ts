import { ArraySchema, type Parameter, SerializationStyle } from '@thymian/core';
import { describe, it } from 'vitest';

import {
  serializeCookieParameter,
  serializePathParameter,
  serializeQueryParameter,
} from '../src/rxjs/serialize-parameter.js';

describe('serialize parameter', () => {
  it('Should serialize path parameter', () => {
    const parameter: Parameter = {
      required: false,
      schema: new ArraySchema(),
      style: new SerializationStyle('form', true),
    };

    // console.log(
    //   serializePathParameter({ role: 'admin', firstName: 'Alex' }, parameter)
    // );
    console.log(serializeCookieParameter([3, 4, 5]));

    //console.log(encodeURIComponent('3 4 5'));
  });

  it('serializeQueryParameter', () => {
    const parameter: Parameter = {
      required: false,
      schema: new ArraySchema(),
      style: new SerializationStyle('spaceDelimited', true),
    };

    console.log(serializeQueryParameter([3, 4, 5], parameter));
  });
});
