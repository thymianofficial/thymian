import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/server-may-coalesce-overlapping-or-small-gapped-ranges'
)
  .severity('hint')
  .type('informational')
  .url('https://datatracker.ietf.org/doc/html/rfc9110#name-multiple-parts')
  .description(
    'When multiple ranges are requested, a server MAY coalesce any of the ranges that overlap, or that are separated by a gap that is smaller than the overhead of sending multiple parts, regardless of the order in which the corresponding range-spec appeared in the received Range header field.'
  )
  .appliesTo('server')
  .done();
