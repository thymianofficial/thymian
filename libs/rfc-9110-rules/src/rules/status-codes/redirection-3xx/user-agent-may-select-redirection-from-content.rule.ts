import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/user-agent-may-select-redirection-from-content'
)
  .severity('hint')
  .type('informational')
  .url(
    'https://datatracker.ietf.org/doc/html/rfc9110#name-300-multiple-choices'
  )
  .description(
    'he user agent MAY make a selection from that list automatically if it understands the provided media type.'
  )
  .done();
