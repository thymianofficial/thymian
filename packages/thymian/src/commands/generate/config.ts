import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import {
  defaultConfig,
  parseSpecFlag,
  ThymianBaseCommand,
} from '@thymian/cli-common';
import { Flags, ux } from '@thymian/cli-common/oclif';
import { confirm, input, select } from '@thymian/cli-common/prompts';
import { stringify } from '@thymian/cli-common/yaml';
import { searchForOpenApiFiles } from '@thymian/openapi';

const DEFAULT_CONFIG_FILENAME = 'thymian.config.yaml';

export default class GenerateConfig extends ThymianBaseCommand<
  typeof GenerateConfig
> {
  static override description =
    'Generate a Thymian configuration file for a single API specification.';

  static override examples = [
    '<%= config.bin %> generate:config',
    '<%= config.bin %> generate:config --no-interactive',
    '<%= config.bin %> generate:config --output my-api.config.yaml',
    '<%= config.bin %> generate:config --for-spec openapi:./petstore.yaml',
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
    ['for-spec']: Flags.string({
      multiple: true,
      description:
        'Specification input in the format [<type>:]<location>. Skips auto-detection and uses the provided spec(s) directly.',
      helpValue: '[type:]location',
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

    // Resolve specification: --for-spec flag takes priority over auto-detection
    let selectedSpec: ReturnType<typeof parseSpecFlag>;

    if (this.flags['for-spec'] && this.flags['for-spec'].length > 0) {
      // Use the first --for-spec value for the config file
      selectedSpec = parseSpecFlag(this.flags['for-spec'][0]!);
    } else {
      // Auto-detect OpenAPI files
      const detectedFiles = await searchForOpenApiFiles(cwd);

      if (interactive) {
        const selectedPath = await this.selectSpecInteractive(detectedFiles);
        selectedSpec = { type: 'openapi', location: selectedPath };
      } else {
        if (detectedFiles.length === 0) {
          this.error(
            'No OpenAPI/Swagger files detected. Provide a specification manually with --for-spec.',
            { exit: 1 },
          );
        }

        if (detectedFiles.length === 1) {
          selectedSpec = { type: 'openapi', location: detectedFiles[0]! };
        } else {
          // In non-interactive mode with multiple specs, use the first one
          selectedSpec = { type: 'openapi', location: detectedFiles[0]! };
          this.log(
            `Multiple specification files detected. Using the first one: ${detectedFiles[0]}`,
          );
        }
      }
    }

    // Build config from defaults
    const config = {
      ...defaultConfig,
      specifications: [selectedSpec],
    };

    // Generate well-commented YAML
    const yamlContent = this.generateCommentedConfig(
      config,
      String(selectedSpec.location),
    );

    await writeFile(outputPath, yamlContent, { encoding: 'utf-8' });

    this.log(`${ux.colorize('green', 'CREATED')} ${relative(cwd, outputPath)}`);
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
    specPath: string,
  ): string {
    const yaml = stringify(config);

    // Prepend a comment header explaining the config
    const header = [
      '# Thymian Configuration',
      '# Generated by `thymian generate:config`',
      '#',
      `# Specification: ${specPath}`,
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
