import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/clients-should-detect-and-intervene-cyclical-redirections'
)
  .severity('warn')
  .type('informational')
  .description(
    'A client SHOULD detect and intervene in cyclical redirections (i.e., "infinite" redirection loops).'
  )
  .done();
