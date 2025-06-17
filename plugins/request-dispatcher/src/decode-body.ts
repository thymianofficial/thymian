import { Readable } from 'stream';

export function decodeBody(
  body?: string,
  encoding?: string
): string | Buffer | Uint8Array | Readable | null {
  if (typeof body !== 'string') {
    return null;
  }

  if (!encoding) {
    return body;
  }

  switch (encoding) {
    case 'base64':
      return Buffer.from(body, 'base64');
    default:
      throw new Error(`Unknown encoding ${encoding}.`);
  }
}
