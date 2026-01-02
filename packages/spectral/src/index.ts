import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import spectralCore from '@stoplight/spectral-core';
import Parsers from '@stoplight/spectral-parsers'; // make sure to install the package if you intend to use default parsers!
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { DiagnosticSeverity } from '@stoplight/types';
const { Spectral, Document } = spectralCore;
import spectralRuntime from '@stoplight/spectral-runtime';
import { type ThymianPlugin, type ThymianReportSeverity } from '@thymian/core';
const { fetch } = spectralRuntime;

import { readFile } from 'node:fs/promises';

import type {} from '@thymian/openapi';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function mapSpectralSeverityToThymianReportSeverity(
  severity: DiagnosticSeverity,
): ThymianReportSeverity {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return 'error';
    case DiagnosticSeverity.Warning:
      return 'warn';
    case DiagnosticSeverity.Information:
      return 'info';
    case DiagnosticSeverity.Hint:
      return 'hint';
  }
}

const spectralPlugin: ThymianPlugin = {
  name: '@thymian/spectral',
  version: '0.0.1',
  async plugin(emitter, logger, options): Promise<void> {
    let openapiDocument: string | undefined;
    let openAPiFilePath: string | undefined;

    emitter.onAction('core.run', async (_, ctx) => {
      if (!openapiDocument || !openAPiFilePath) {
        throw new Error('openapi.document action must be called first.');
      }

      const spectralDocument = new Document(
        await readFile(openAPiFilePath, { encoding: 'utf-8' }),
        Parsers.Json,
        openAPiFilePath,
      );

      const spectral = new Spectral();
      const rulesetFilepath =
        '/Users/matthias/Thymian/thymian/packages/spectral/src/.spectral.yaml';

      spectral.setRuleset(
        await bundleAndLoadRuleset(rulesetFilepath, { fs, fetch }),
      );
      /*
      {
  producer: string;
  source?: string;
  severity: ThymianReportSeverity;
  summary: string;
  title: string;
  links?: { title?: string; url: string }[];
  timestamp?: number;
  details?: string;
  category?: string | 'No Category';
  location?: {
    reference?: ThymianFormatLocation;
    format?: {
      elementType: 'node' | 'edge';
      id: string;
    };
  };
}
       */

      for (const result of await spectral.run(spectralDocument)) {
        emitter.emit('core.report', {
          producer: '@thymian/spectral',
          severity: mapSpectralSeverityToThymianReportSeverity(result.severity),
          title: openAPiFilePath, // + result.path.join('/').replaceAll('//', '/'),
          summary: result.message,
          source:
            openAPiFilePath +
            ':' +
            (result.range.start.line + 1) +
            ':' +
            (result.range.start.character + 1),
          links: [
            {
              title: 'Spectral Documentation',
              url: result.documentationUrl!,
            },
          ],
        });
      }
    });

    emitter.on('openapi.document', ({ document, filePath }) => {
      openapiDocument = JSON.stringify(document);
      openAPiFilePath = path.resolve(filePath);
    });
  },
};

export default spectralPlugin;
