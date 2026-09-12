import {
  rule as requireRuleTags,
  RULE_NAME as requireRuleTagsName,
} from './rules/require-rule-tags.js';

export default {
  rules: {
    [requireRuleTagsName]: requireRuleTags,
  },
};
