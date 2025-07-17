import { PromiseQueue } from './promise-queue.js';

export const promptQueue = new PromiseQueue();

export function runPrompts<T>(fn: () => Promise<T>): Promise<T> {
  return promptQueue.add(fn);
}

export * from '@inquirer/prompts';
