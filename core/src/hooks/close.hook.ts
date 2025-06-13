import type { Hook } from './hook.js';

export type CloseHookResult = {
  pluginName: string;
  status: 'success' | 'failed' | 'error';
  message?: string;
};

export type CloseHook = Hook<[], CloseHookResult>;
