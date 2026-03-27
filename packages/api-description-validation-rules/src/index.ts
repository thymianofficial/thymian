import type { RuleSet } from '@thymian/core';

const apiDescriptionValidation: RuleSet = {
  name: '@thymian/api-description-validation-rules',
  pattern: 'rules/**/*.rule.js',
};

export default apiDescriptionValidation;
