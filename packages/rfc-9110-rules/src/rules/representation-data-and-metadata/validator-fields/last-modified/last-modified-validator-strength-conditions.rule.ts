import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/last-modified-validator-strength-conditions')
  .severity('off')
  .type('informational')
  .appliesTo('origin server', 'client', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2.2')
  .description(
    `A Last-Modified time is implicitly weak unless it is possible to deduce that it is strong. A Last-Modified
    time is strong if at least one of the following conditions is true:

    1. The validator is being compared by an origin server to the actual current validator AND that origin server
       reliably knows that the representation did not change twice during the second covered by the presented validator.

    2. The validator is about to be used by a client in If-Modified-Since, If-Unmodified-Since, or If-Range header
       field AND the client has a cache entry AND that cache entry includes a Date value which is at least one second
       after the Last-Modified value.

    3. The validator is being compared by an intermediate cache to the validator stored in its cache entry AND that
       cache entry includes a Date value which is at least one second after the Last-Modified value.

    These conditions ensure that the Last-Modified timestamp has sufficient resolution to detect all changes.

    Note: This rule documents the conditions but cannot be automatically validated as it requires runtime context
    about the comparison scenario and available metadata.`,
  )
  .summary('Last-Modified is weak unless specific conditions make it strong.')
  .done();
