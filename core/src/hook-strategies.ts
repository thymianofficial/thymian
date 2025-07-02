export type CollectStrategy = {
  type: 'collect';
};

export type DeepMergeStrategy = {
  type: 'deep-merge';
};

export type HookStrategy = CollectStrategy | DeepMergeStrategy;
