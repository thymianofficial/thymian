import { Flags } from '@oclif/core';

export const ruleSetFlag = Flags.custom<string>({
  description:
    'Add a rule set package to use for validation (e.g. @thymian/rules-rfc-9110). Can be specified multiple times.',
  multiple: true,
  helpValue: 'package-name',
  helpGroup: 'BASE',
  parse: async (input) => input,
});
