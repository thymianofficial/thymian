import { createHttpLinterPlugin } from '@thymian/http-linter/plugin-factories';

export {
  type BaseHttpValidationPluginOptions,
  createHttpLinterPlugin,
  type HttpLinterPluginOptions,
} from '@thymian/http-linter/plugin-factories';

export const httpLinterPlugin = createHttpLinterPlugin();

export default httpLinterPlugin;
