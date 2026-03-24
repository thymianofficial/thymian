import { createHttpTesterPlugin } from '@thymian/http-linter/plugin-factories';

export { HttpTestApiContext } from '@thymian/http-linter';
export {
  type BaseHttpValidationPluginOptions,
  createHttpTesterPlugin,
  type HttpTesterPluginOptions,
} from '@thymian/http-linter/plugin-factories';

export const httpTesterPlugin = createHttpTesterPlugin();

export default httpTesterPlugin;
