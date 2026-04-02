import { Flags } from '@oclif/core';

export const ruleSetFlag = Flags.custom<string>({
  description:
    'Add a rule set package to use for validation (e.g. @thymian/rfc-9110-rules). Can be specified multiple times.',
  multiple: true,
  helpValue: 'package-name',
  helpGroup: 'BASE',
  parse: async (input) => input,
});
