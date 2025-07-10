import etag from 'etag';
import type { FastifyInstance } from 'fastify';

export function generateAlphabetBuffer() {
  const buffer = Buffer.alloc(1000);
  const charCode = 'A'.charCodeAt(0);
  let counter = 0;

  for (let i = 0; i < 1000; i++) {
    buffer[i] = charCode + Math.floor(counter++ / 50);
  }

  return buffer;
}

// https://backend.cafe/how-to-implement-video-streaming-with-fastify
export default async function rangeRequests(app: FastifyInstance) {
  const bufferSize = 1_000;
  const buffer = generateAlphabetBuffer();

  // valid implementation of a range request
  app.get('/valid', async (req, reply) => {
    const range = req.range(bufferSize);

    reply.header('cache-control', 'private');

    if (!range) {
      return reply.header('etag', etag(buffer)).status(200).send(buffer);
    }

    const singleRange = range.ranges[0]!;

    const { start, end } = singleRange;
    const finalEnd = Math.min(end, bufferSize - 1);
    const contentLength = finalEnd - start + 1;

    reply.headers({
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${bufferSize}`,
      'Content-Length': contentLength,
    });

    const partialBuffer = buffer.subarray(start, end - start);
    return reply
      .code(206)
      .header('etag', etag(partialBuffer))
      .send(partialBuffer);
  });

  // invalid implementation of a range request, because "cache-control", and "etag" headers are not sent in 206 response but in 200 response
  app.get('/invalid', async (req, reply) => {
    const range = req.range(bufferSize);

    if (!range) {
      return reply
        .status(200)
        .header('etag', etag(buffer))
        .header('cache-control', 'private, max-age=12000')
        .send(buffer);
    }

    const singleRange = range.ranges[0]!;

    const { start, end } = singleRange;
    const finalEnd = Math.min(end, bufferSize - 1);
    const contentLength = finalEnd - start + 1;

    reply.headers({
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${bufferSize}`,
      'Content-Length': contentLength,
    });

    return reply.code(206).send(buffer.subarray(start, end - start));
  });
}

export const autoPrefix = '/video-streaming';
