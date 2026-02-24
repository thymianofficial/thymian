import { httpRule } from '@thymian/http-linter';

export default httpRule('rfc9110/header-section-consists-of-field-lines')
  .severity('hint')
  .type('informational')
  .appliesTo('client', 'server', 'intermediary')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#section-6.3')
  .description(
    'The "header section" of a message consists of a sequence of header field lines. Each header field might modify or extend message semantics, describe the sender, define the content, or provide additional context.',
  )
  .summary(
    'Header section contains field lines that modify semantics, describe sender, or provide context.',
  )
  .done();
