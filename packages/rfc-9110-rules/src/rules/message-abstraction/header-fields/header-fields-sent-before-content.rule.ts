import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/header-fields-sent-before-content')
  .severity('hint')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.3')
  .description(
    'Fields (Section 5) that are sent or received before the content are referred to as "header fields" (or just "headers", colloquially).',
  )
  .summary('Header fields are fields sent before message content.')
  .done();
