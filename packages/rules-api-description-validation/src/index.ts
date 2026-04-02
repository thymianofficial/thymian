import type { RuleSet } from '@thymian/core';

const apiDescriptionValidation: RuleSet = {
  name: '@thymian/rules-api-description-validation',
  pattern: 'rules/**/*.rule.js',
};

export default apiDescriptionValidation;
