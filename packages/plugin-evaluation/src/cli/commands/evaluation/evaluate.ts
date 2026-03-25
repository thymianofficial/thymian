import { createWriteStream, type WriteStream } from 'node:fs';
import * as os from 'node:os';
import { isAbsolute, join } from 'node:path';

import { Args, Command } from '@thymian/cli-common/oclif';
import { Thymian } from '@thymian/core';
import { httpLinterPlugin } from '@thymian/http-linter';
import { Piscina } from 'piscina';
import { glob } from 'tinyglobby';

import type { WorkerData, WorkerResult } from '../../worker.js';

function makeStringCsvSafe<T extends string | undefined>(str: T): T {
  if (str === undefined) {
    return str;
  }

  return ('"' + str.replaceAll('\n', ' ').replaceAll('"', '""') + '"') as T;
}

export default class Evaluate extends Command {
  private writeLock: Promise<void> = Promise.resolve();
  private pool!: Piscina;

  static override description =
    'Evaluates all OpenAPI and Swagger files within a directory.';

  static override examples = [
    '<%= config.bin %> <%= command.id %> ./dir/to/openapi/documents ./results run-1.csv',
  ];

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
      description: 'The file to store the evaluation results in.',
      default: 'results.csv',
    }),
  };

  private stream!: WriteStream;

  private ruleNames: Record<string, number> = {};

  private async initStream(path: string): Promise<void> {
    const thymian = new Thymian();
    thymian.register(httpLinterPlugin, {
      ruleSets: ['@thymian/rfc-9110-rules'],
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
      filename: join(import.meta.dirname, '../..', 'worker.js'),
      maxThreads: 1,
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

    const baseResultDir = isAbsolute(args.resultsDir)
      ? args.resultsDir
      : join(process.cwd(), args.resultsDir);

    await this.initStream(join(baseResultDir, args.resultsFile));

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
    const tasks = matches.map(async (match, idx) => {
      const filePath = join(openApiDir, match);

      const workerData: WorkerData = {
        filePath: filePath,
      };

      try {
        const result = (await this.pool.run(workerData)) as WorkerResult;

        await this.writeReport(join(openApiDir, match), result);

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
