import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { getRandomId } from '../../utils.js';
import type { Todo } from './todo.model.js';

export interface TodoRepository {
  getAll(): Todo[];
  getByProjectId(id: string): Todo[];
  getById(id: string): Todo | undefined;
  create(input: { title: string; projectId?: string; done?: boolean }): Todo;
  deleteById(id: string): boolean;
  exists(id: string): boolean;
  update(todo: Todo): boolean;
}

export default fp(async (fastify: FastifyInstance) => {
  const todos: Todo[] = [
    {
      id: '42',
      title: 'My first todo',
      done: false,
    },
  ];

  const repo: TodoRepository = {
    getByProjectId(id: string): Todo[] {
      return todos.filter((t) => t.projectId === id);
    },
    getAll: () => [...todos],
    getById: (id) => todos.find((p) => p.id === id),
    create: ({ title, projectId, done }) => {
      const id = getRandomId();
      const todo = { id, projectId, done: done ?? false, title };
      todos.push(todo);
      return todo;
    },
    deleteById: (id) => {
      const index = todos.findIndex((p) => p.id === id);
      if (index === -1) return false;
      todos.splice(index, 1);
      return true;
    },
    exists: (id) => todos.some((p) => p.id === id),
    update(todo: Todo): boolean {
      const idx = todos.findIndex((t) => t.id === todo.id);

      if (idx === -1) return false;

      todos[idx] = todo;

      return true;
    },
  };

  fastify.decorate('todos', repo);
});
