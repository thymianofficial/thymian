export interface Todo {
  id: string;
  title: string;
  done: boolean;
  projectId?: string | null;
}

export const TodoSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    done: { type: 'boolean' },
    projectId: { type: ['string', 'null'] },
  },
  required: ['id', 'title', 'done'],
} as const;
