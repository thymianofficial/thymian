import { bundle } from '@scalar/json-magic/bundle';
import {
  parseJson,
  parseYaml,
  readFiles,
} from '@scalar/json-magic/bundle/plugins/node';
import { dereference, validate } from '@scalar/openapi-parser';
import { upgrade } from '@scalar/openapi-upgrader';
import { NoopLogger, Thymian } from '@thymian/core';
import httpLinterPlugin from '@thymian/http-linter';
import openApiPlugin from '@thymian/openapi';

export interface WorkerResult {
  success: boolean;
  title?: string;
  version?: string;
  violations: Record<string, number>;
  reportsCount: {
    error: number;
    warn: number;
    hint: number;
    info: number;
  };
  errorMessage?: string;
}

export interface WorkerData {
  filePath: string;
}

export default async function ({
  filePath,
}: WorkerData): Promise<WorkerResult> {
  const thymian = new Thymian(new NoopLogger(), {
    timeout: 100000,
  });

  try {
    const bundled = await tryBundle(filePath);

    await tryValidate(bundled);

    tryDereference(tryUpgrade(bundled));

    thymian.register(openApiPlugin, {
      descriptions: [{ source: filePath }],
    });

    thymian.register(httpLinterPlugin, {
      rules: ['@thymian/rfc-9110-rules'],
      modes: ['static'],
      ruleFilter: { ruleTypes: ['static'] },
    });

    let version: string | undefined;
    let title: string | undefined;

    const report = await thymian.run(async (emitter) => {
      emitter.on('openapi.document', ({ document }) => {
        title = document.info.title;
        version =
          'openapi' in document
            ? document.openapi
            : 'swagger' in document
              ? document.swagger
              : undefined;
      });

      const format = await thymian.loadFormat({ emitFormat: true });
      return await emitter.emitAction(
        'http-linter.lint-static',
        { format: format.export() },
        { strategy: 'first' },
      );
    });

    if (!version || !title) {
      throw new Error('Could not determine OpenAPI version/title.');
    }

    const violations: Record<string, number> = {};
    const reportsCount = { error: 0, warn: 0, hint: 0, info: 0 };

    for (const r of report.reports) {
      if (r.source) {
        violations[r.source] = (violations[r.source] || 0) + 1;
      }
      reportsCount[r.severity] += 1;
    }

    return {
      success: true,
      title,
      version,
      violations,
      reportsCount,
    };
  } catch (error: any) {
    return {
      success: false,
      violations: {},
      reportsCount: { error: 0, warn: 0, hint: 0, info: 0 },
      errorMessage: error.message || 'Unknown error',
    };
  }
}

async function tryBundle(path: string): Promise<object> {
  try {
    return await bundle(path, {
      plugins: [parseJson(), parseYaml(), readFiles()],
      treeShake: false,
    });
  } catch (e) {
    throw new Error(`cannot bundle`);
  }
}

async function tryValidate(document: object): Promise<void> {
  const validated = await validate(document, { throwOnError: false });

  if (!validated.valid) {
    throw new Error('invalid OpenAPI document');
  }
}

function tryUpgrade(document: object): object {
  try {
    return upgrade(document, '3.1');
  } catch (e) {
    throw new Error('cannot upgrade');
  }
}

function tryDereference(document: object): void {
  try {
    dereference(document);
  } catch (e) {
    throw new Error('cannot dereference');
  }
}
