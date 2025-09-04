import { httpRule } from '@thymian/http-linter';

export default httpRule(
  'rfc9110/origin-server-must-disable-safe-methods-for-unsafe-resources'
)
  .severity('error')
  .type('informational')
  .url('https://www.rfc-editor.org/rfc/rfc9110.html#name-safe-methods')
  .summary(
    'If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method.'
  )
  .description(
    'When a resource is constructed such that parameters within the target URI have the effect of selecting an action, it is the resource owner\'s responsibility to ensure that the action is consistent with the request method semantics. For example, it is common for Web-based content editing software to use actions within query parameters, such as "page?do=delete". If the purpose of such a resource is to perform an unsafe action, then the resource owner MUST disable or disallow that action when it is accessed using a safe request method.'
  )
  .appliesTo('origin server')
  .done();
