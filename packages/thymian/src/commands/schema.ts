import { BaseCliRunCommand, thymianConfigSchema } from '@thymian/common-cli';

const configSchema = {
  ...thymianConfigSchema,
};

export default class GenerateConfigSchema extends BaseCliRunCommand<
  typeof GenerateConfigSchema
> {
  override async run(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    configSchema.properties.plugins['properties'] = {};

    for (const { plugin } of this.thymian.plugins) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      configSchema.properties.plugins['properties'][plugin.name] = {
        type: 'object',
        required: ['options'],
        properties: {
          path: {
            type: 'string',
          },
          verbose: {
            type: 'boolean',
          },
          options: plugin.options,
        },
      };
    }

    this.log(JSON.stringify(configSchema, null, 2));
  }
}
