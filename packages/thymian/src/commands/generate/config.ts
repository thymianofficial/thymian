import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import {
  defaultConfig,
  specFlag,
  ThymianBaseCommand,
} from '@thymian/common-cli';
import { Flags, ux } from '@thymian/common-cli/oclif';
import { confirm, input, select } from '@thymian/common-cli/prompts';
import { stringify } from '@thymian/common-cli/yaml';
import type { SpecificationInput } from '@thymian/core';
import { searchForOpenApiFiles } from '@thymian/plugin-openapi';

const DEFAULT_CONFIG_FILENAME = 'thymian.config.yaml';

export default class GenerateConfig extends ThymianBaseCommand<
  typeof GenerateConfig
> {
  static override description =
    'Generate a Thymian configuration file for one or more API specifications.';

  static override examples = [
    '<%= config.bin %> generate config',
    '<%= config.bin %> generate config --no-interactive',
    '<%= config.bin %> generate config --output my-api.config.yaml',
    '<%= config.bin %> generate config --for-spec openapi:./petstore.yaml',
    '<%= config.bin %> generate config --for-spec openapi:./petstore.yaml --for-spec openapi:./orders.yaml',
  ];

  static override flags = {
    cwd: Flags.string({
      default: process.cwd(),
      description: 'Set current working directory.',
    }),
    interactive: Flags.boolean({
      default: true,
      allowNo: true,
      description:
        'Run in interactive mode. Use --no-interactive for automation.',
    }),
    output: Flags.string({
      description:
        'Output path for the generated configuration file. Defaults to thymian.config.yaml in the working directory.',
    }),
    ['for-spec']: specFlag({
      description:
        'Specification input in the format <type>:<location>. Skips auto-detection and adds each provided specification directly.',
    }),
  };

  public async run(): Promise<void> {
    const cwd = this.flags.cwd;
    const interactive = this.flags.interactive;

    // Determine output path
    let outputPath = this.flags.output
      ? join(cwd, this.flags.output)
      : join(cwd, DEFAULT_CONFIG_FILENAME);

    // Continuation flow: if default config exists and no explicit output, offer named config
    if (!this.flags.output && existsSync(outputPath)) {
      if (interactive) {
        this.log(`A configuration file already exists at ${outputPath}.`);
        const customPath = await input({
          message:
            'Enter a path for the new configuration file (e.g. my-api.config.yaml):',
        });

        if (!customPath) {
          this.error('No path provided. Aborting.', { exit: 1 });
        }

        outputPath = join(cwd, customPath);
      } else {
        this.error(
          `Configuration file already exists at ${outputPath}. Use --output to specify a different path.`,
          { exit: 1 },
        );
      }
    }

    // Guard against overwriting an existing file at the resolved output path.
    // The default-config-exists case is already handled above; this covers
    // --output pointing to an existing file or an interactive custom path that
    // already exists.
    if (existsSync(outputPath)) {
      if (interactive) {
        const overwrite = await confirm({
          message: `File already exists at ${outputPath}. Overwrite?`,
          default: false,
        });

        if (!overwrite) {
          this.error('Aborted to avoid overwriting existing file.', {
            exit: 1,
          });
        }
      } else {
        this.error(
          `File already exists at ${outputPath}. Use a different --output path or remove the existing file.`,
          { exit: 1 },
        );
      }
    }

    // Resolve specification: --for-spec flag takes priority over auto-detection
    let selectedSpecs: SpecificationInput[];

    if (this.flags['for-spec'] && this.flags['for-spec'].length > 0) {
      selectedSpecs = this.flags['for-spec'];
    } else {
      // Auto-detect OpenAPI files
      const detectedFiles = await searchForOpenApiFiles(cwd);

      if (interactive) {
        const selectedPath = await this.selectSpecInteractive(detectedFiles);
        selectedSpecs = [{ type: 'openapi', location: selectedPath }];
      } else {
        if (detectedFiles.length === 0) {
          this.error(
            'No OpenAPI/Swagger files detected. Provide a specification manually with --for-spec.',
            { exit: 1 },
          );
        }

        if (detectedFiles.length === 1) {
          selectedSpecs = [{ type: 'openapi', location: detectedFiles[0]! }];
        } else {
          // In non-interactive mode with multiple specs, use the first one
          selectedSpecs = [{ type: 'openapi', location: detectedFiles[0]! }];
          this.log(
            `Multiple specification files detected. Using the first one: ${detectedFiles[0]}`,
          );
        }
      }
    }

    // Build config from defaults
    const config = {
      ...defaultConfig,
      specifications: selectedSpecs,
    };

    // Generate well-commented YAML
    const yamlContent = this.generateCommentedConfig(config, selectedSpecs);

    await writeFile(outputPath, yamlContent, { encoding: 'utf-8' });

    this.log(
      `${ux.colorize('green', 'Configuration written to')} ${relative(cwd, outputPath)}`,
    );
  }

  private async selectSpecInteractive(
    detectedFiles: string[],
  ): Promise<string> {
    if (detectedFiles.length === 0) {
      // No files detected — ask for manual entry
      this.log('No OpenAPI/Swagger specification files detected.');
      const manualPath = await input({
        message: 'Enter the path to your OpenAPI specification file:',
      });

      if (!manualPath) {
        this.error('No specification path provided. Aborting.', { exit: 1 });
      }

      return manualPath;
    }

    if (detectedFiles.length === 1) {
      // Single file — confirm
      const useDetected = await confirm({
        message: `Detected specification: ${detectedFiles[0]}. Use this file?`,
        default: true,
      });

      if (useDetected) {
        return detectedFiles[0]!;
      }

      // User declined — ask for manual entry
      const manualPath = await input({
        message: 'Enter the path to your OpenAPI specification file:',
      });

      if (!manualPath) {
        this.error('No specification path provided. Aborting.', { exit: 1 });
      }

      return manualPath;
    }

    // Multiple files — selection list
    const selected = await select({
      message: 'Multiple specification files detected. Select one:',
      choices: detectedFiles.map((file) => ({
        name: file,
        value: file,
      })),
    });

    return selected;
  }

  private generateCommentedConfig(
    config: typeof defaultConfig & {
      specifications: ReturnType<typeof parseSpecFlag>[];
    },
    specifications: ReturnType<typeof parseSpecFlag>[],
  ): string {
    const yaml = stringify(config);
    const specCommentLines = specifications.map(
      (spec) => `# Specification: ${spec.type}:${String(spec.location)}`,
    );

    // Prepend a comment header explaining the config
    const header = [
      '# Thymian Configuration',
      '# Generated by `thymian generate config`',
      '#',
      ...specCommentLines,
      '#',
      '# For documentation, see: https://thymian.dev/docs/configuration',
      '#',
      '# Run `thymian lint` to validate your API specification.',
      '# Run `thymian test` to test a live API against the specification.',
      '#',
      '',
    ].join('\n');

    return header + yaml;
  }
}
