declare module '@oclif/core/interfaces' {
  interface Hooks {
    'thymian.feedback': {
      options: Record<PropertyKey, unknown>;
    };
  }
}

export type ThymianFeedbackHook = () => Promise<void>;
