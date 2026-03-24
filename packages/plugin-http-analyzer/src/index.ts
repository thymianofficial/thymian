import { createHttpAnalyzerPlugin } from '@thymian/http-linter/plugin-factories';

export {
  type BaseHttpValidationPluginOptions,
  createHttpAnalyzerPlugin,
  type HttpAnalyzerPluginOptions,
} from '@thymian/http-linter/plugin-factories';

export const httpAnalyzerPlugin = createHttpAnalyzerPlugin();

export default httpAnalyzerPlugin;
