import { parseMIMEType } from 'undici';

export type EncodedString = {
  str: string;
  encoding: string;
};

export function encodeResponseBody(
  array: Uint8Array,
  contentType: string
): EncodedString {
  const parsed = parseMIMEType(contentType);

  if (parsed === 'failure') {
    throw new Error();
  }

  const type = parsed.type as
    | 'audio'
    | 'video'
    | 'image'
    | 'application'
    | 'model'
    | 'example'
    | 'font'
    | 'text';
  const charset = parsed.parameters.get('charset');

  switch (type) {
    case 'application': {
      if (parsed.subtype.includes('octet-stream')) {
        return {
          str: Buffer.from(array).toString('base64'),
          encoding: 'base64',
        };
      }

      if (charset) {
        return {
          str: new TextDecoder(charset).decode(array),
          encoding: charset,
        };
      } else {
        const utf8String = Buffer.from(array).toString('utf-8');

        if (utf8String.includes('\ufffd')) {
          return {
            str: Buffer.from(array).toString('base64'),
            encoding: 'base64',
          };
        } else {
          return {
            str: utf8String,
            encoding: 'utf-8',
          };
        }
      }
    }
    case 'text': {
      const encoding = charset ?? 'utf-8';
      return {
        str: new TextDecoder(encoding).decode(array),
        encoding,
      };
    }
    case 'audio':
    case 'video':
    case 'image':
    case 'model':
    case 'example':
    case 'font':
    default:
      return {
        str: Buffer.from(array).toString('base64'),
        encoding: 'base64',
      };
  }
}
