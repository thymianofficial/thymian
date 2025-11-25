export interface Project {
  id: string;
  name: string;
  description?: string;
}

export const ProjectSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['id', 'name'],
} as const;
