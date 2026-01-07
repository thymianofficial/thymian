import { createWriteStream, type WriteStream } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { Args, Command } from '@thymian/cli-common/oclif';
import { Thymian } from '@thymian/core';
import httpLinterPlugin from '@thymian/http-linter';
import { Piscina } from 'piscina';
import { glob } from 'tinyglobby';

import type { WorkerData, WorkerResult } from '../worker.js';

function makeStringCsvSafe<T extends string | undefined>(str: T): T {
  return (str ? `"${str.replaceAll('\n', ' ')}"` : null) as T;
}

export default class Evaluate extends Command {
  private writeLock: Promise<void> = Promise.resolve();
  private pool!: Piscina;

  static override description =
    'Statically lints all OpenAPI and Swagger files within a directory.';

  static override args = {
    directory: Args.directory({
      description: 'The directory to evaluate.',
      required: true,
    }),
    resultsDir: Args.directory({
      required: true,
      description: 'The directory to store the evaluation results.',
    }),
    resultsFile: Args.file({
      required: false,
      default: 'results.csv',
    }),
  };

  private stream!: WriteStream;

  private ruleNames: Record<string, number> = {};

  private async initStream(path: string): Promise<void> {
    const thymian = new Thymian();
    thymian.register(httpLinterPlugin, {
      rules: ['@thymian/rfc-9110-rules'],
      modes: ['static'],
      ruleFilter: {
        ruleTypes: ['static'],
      },
    });

    const rules = await thymian.run((emitter) =>
      emitter.emitAction('http-linter.rules', undefined, {
        strategy: 'first',
      }),
    );

    const ruleNames = rules.map((rule) => rule.meta.name).sort();

    this.log(`Found ${ruleNames.length} rules.`);

    ruleNames.forEach((ruleName) => (this.ruleNames[ruleName] = 0));

    this.stream = createWriteStream(path, 'utf-8');

    await new Promise<void>((resolve, reject) => {
      this.stream.on('ready', () => {
        this.writeStream(
          'title,path,version,success,reason,number of violations,errors,warnings,hints,' +
            ruleNames.map(makeStringCsvSafe).join(',') +
            '\n',
        ).then(resolve, reject);
      });
    });

    this.pool = new Piscina({
      filename: join(import.meta.dirname, '..', 'worker.js'),
      idleTimeout: 10000,
    });
  }

  private closeStream(): Promise<void> {
    return new Promise((resolve) => {
      this.stream.end(() => {
        resolve();
      });
    });
  }

  override async run(): Promise<void> {
    const { args } = await this.parse(Evaluate);

    this.log(`Evaluating directory: ${args.directory}`);

    const openapiCwd = isAbsolute(args.directory)
      ? args.directory
      : join(process.cwd(), args.directory);

    await this.initStream(join(args.resultsDir, args.resultsFile));

    const matches = await glob('**/*.{yaml,yml,json}', {
      cwd: openapiCwd,
      deep: 50,
    });

    this.log(`Found ${matches.length} OpenAPI/Swagger files.`);

    await this.evaluate(matches, openapiCwd);
  }

  private writeStream(content: string): Promise<void> {
    this.writeLock = this.writeLock.then(() => {
      return new Promise((resolve, reject) => {
        this.stream.write(content, (err) => {
          if (err) {
            reject(err);
          }

          resolve();
        });
      });
    });

    return this.writeLock;
  }

  private async writeReport(path: string, data: WorkerResult): Promise<void> {
    let row = `${makeStringCsvSafe(data.title)},${makeStringCsvSafe(path)},${makeStringCsvSafe(data.version)},${data.success},${makeStringCsvSafe(data.errorMessage)},${data.reportsCount.hint + data.reportsCount.warn + data.reportsCount.error},${data.reportsCount.error},${data.reportsCount.warn},${data.reportsCount.hint},`;

    const finalViolations = { ...this.ruleNames, ...data.violations };

    row +=
      Object.keys(finalViolations)
        .sort()
        .map((key) => finalViolations[key])
        .join(',') + '\n';

    await this.writeStream(row);
  }

  private async evaluate(matches: string[], openApiDir: string): Promise<void> {
    // let evaluationCounter = 0;
    // const evaluationStart = performance.now();
    // const numberOfDocuments = matches.length;
    //
    // matches.splice(0, 400);
    //
    // let start = performance.now();
    //
    // for (const [idx, match] of matches.entries()) {
    //   const fullFilePath = join(openApiDir, match);
    //
    //   console.log(`Analyzing file ${fullFilePath}`);
    //
    //   const thymian = new Thymian(
    //     useLogger ? new TextLogger('@thymian/evaluation') : new NoopLogger(),
    //     {
    //       timeout: 100000,
    //     },
    //   );
    //
    //   this.debug(`Analyzing file ${fullFilePath}...`);
    //
    //   thymian.register(openApiPlugin, {
    //     descriptions: [
    //       {
    //         source: fullFilePath,
    //       },
    //     ],
    //   });
    //   thymian.register(httpLinterPlugin, {
    //     rules: ['@thymian/rfc-9110-rules'],
    //     modes: ['static'],
    //     ruleFilter: {
    //       ruleTypes: ['static'],
    //     },
    //   });
    //
    //   let version: string | undefined;
    //   let title: string | undefined;
    //
    //   try {
    //     const bundled = await this.tryBundle(fullFilePath);
    //
    //     await this.tryValidate(bundled);
    //
    //     this.tryDereference(this.tryUpgrade(bundled));
    //
    //     const report = await thymian.run(async (emitter) => {
    //       emitter.on('openapi.document', ({ document }) => {
    //         title = document.info.title;
    //         version =
    //           'openapi' in document
    //             ? document.openapi
    //             : 'swagger' in document
    //               ? document.swagger
    //               : undefined;
    //       });
    //
    //       const format = await thymian.loadFormat({ emitFormat: true });
    //
    //       return await emitter.emitAction(
    //         'http-linter.lint-static',
    //         {
    //           format: format.export(),
    //         },
    //         {
    //           strategy: 'first',
    //         },
    //       );
    //     });
    //
    //     if (!version || !title) {
    //       throw new Error(
    //         `Could not determine OpenAPI version and/or title for ${match}.`,
    //       );
    //     }
    //
    //     await this.writeReport(
    //       report.reports,
    //       title,
    //       fullFilePath,
    //       version,
    //       true,
    //       null,
    //     );
    //   } catch (e) {
    //     this.error(`Error while analyzing file ${fullFilePath}.`, {
    //       exit: false,
    //     });
    //
    //     await this.writeReport(
    //       [],
    //       title ?? 'No title',
    //       fullFilePath,
    //       version ?? 'unknown version',
    //       false,
    //       isRecord(e) && 'message' in e ? String(e.message) : 'Unknown error',
    //     );
    //     evaluationCounter++;
    //   }
    //
    //   if ((idx + 1) % 100 === 0) {
    //     this.log(
    //       `Analyzed ${idx + 1} files in ${((performance.now() - start) / 1000).toPrecision(4)} s.`,
    //     );
    //     start = performance.now();
    //     if (global.gc) {
    //       const used = process.memoryUsage().heapUsed / 1024 / 1024;
    //       this.log(`Memory usage: ${Math.round(used * 100) / 100} MB`);
    //       global.gc();
    //     }
    //   }
    // }
    //
    // await this.closeStream();

    matches.splice(0, 2595);

    const tasks = matches.map(async (match, idx) => {
      const filePath = join(openApiDir, match);

      const workerData: WorkerData = {
        filePath: filePath,
      };

      try {
        const result = (await this.pool.run(workerData)) as WorkerResult;

        await this.writeReport(join(openApiDir, match), result);

        if (!result.success) {
          // this.warn(`Analysis failed for ${match}.`);
        }

        return result.success;
      } catch (_) {
        this.error(`WORKER CRASHED on file: ${match}. Skipping file.`, {
          exit: false,
        });

        await this.writeReport(filePath, {
          success: false,
          violations: {},
          reportsCount: { error: 0, warn: 0, hint: 0, info: 0 },
          errorMessage: 'Worker Crashed',
          title: 'CRASH',
          version: 'unknown',
        });
      }

      if ((idx + 1) % 100 === 0) {
        this.log(`Processed ${idx + 1} / ${matches.length} files.`);
      }

      return false;
    });

    const results = await Promise.all(tasks);

    const successCount = results.filter((r) => r).length;

    this.log(
      `Processed ${successCount} / ${matches.length} (${((successCount / matches.length) * 100).toPrecision(3)}%) files successfully.`,
    );

    await this.closeStream();
  }
}
