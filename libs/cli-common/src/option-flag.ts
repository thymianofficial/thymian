import { Errors, Flags } from '@oclif/core';

export const optionRegexp = /^(.*)\.(.*)=(.*)$/;

export const optionFlag = Flags.custom<string>({
  description: 'Override configuration values for plugins.',
  multiple: true,
  helpValue: 'key=value',
  charAliases: ['o'],
  helpGroup: 'BASE',
  parse: async (input: string) => {
    if (!optionRegexp.test(input)) {
      throw new Errors.CLIError(
        `Invalid option format: ${input}. Use format <pluginName>.<property>=<value>.`
      );
    }

    return input;
  },
});
