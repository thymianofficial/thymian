import type { HookResult } from './thymian-emitter.js';

export type AggregateStrategy<T, R = T> = {
  type: 'aggregate';
  merger: (results: HookResult<T>[]) => R;
};

export type CollectStrategy = {
  type: 'collect';
};

export type DeepMergeStrategy = {
  type: 'deep-merge';
};

export type VoteStrategy = {
  type: 'vote';
};

export type HookStrategy =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AggregateStrategy<any> | CollectStrategy | DeepMergeStrategy | VoteStrategy;
