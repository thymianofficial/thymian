export type RuleViolationLocation = {
  elementType: 'node' | 'edge';
  elementId: string;
  pointer?: string;
};

export type RuleViolation = {
  message?: string;
  location: RuleViolationLocation;
};
