import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { type Logger, ThymianBaseError } from '@thymian/core';

import type { HttpRequestSample } from '../http-request-sample.js';
import { createPathForTransaction } from './create-path-for-transaction.js';
import type { OutputWriter } from './output-writer.js';

export function hash(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

export class FileOutputWriter implements OutputWriter {
  constructor(
    private readonly basePath: string,
    private readonly force: boolean,
  ) {}

  async writeAssetFor(
    value: Buffer,
    ext: string,
    sample: HttpRequestSample,
  ): Promise<string> {
    const path = join(
      this.basePath,
      createPathForTransaction(sample.meta.source),
    );

    await mkdir(path, { recursive: true });

    const fileName =
      hash(sample.meta.source.transaction.label) +
      (ext.startsWith('.') ? ext : `.${ext}`);

    const pathName = join(path, fileName);

    await writeFile(pathName, value, {
      encoding: (sample.request.bodyEncoding as BufferEncoding) ?? 'utf-8',
    });

    return fileName;
  }

  async writeSample(sample: HttpRequestSample): Promise<string> {
    const path = join(
      this.basePath,
      createPathForTransaction(sample.meta.source),
    );
    await mkdir(path, { recursive: true });

    const fileName = join(path, 'request.json');

    try {
      const flag = this.force ? 'w' : 'wx';

      await writeFile(fileName, JSON.stringify(sample), {
        encoding: 'utf8',
        flag,
      });

      return fileName;
    } catch (e) {
      throw new ThymianBaseError(`Cannot write sample to "${fileName}".`, {
        suggestions: [
          'Does the file already exists? If you want to overwrite it, use "--option @thymian/sampler.force=true".',
        ],
        cause: e,
      });
    }
  }
}
