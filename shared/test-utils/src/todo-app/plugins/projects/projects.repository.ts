import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { getRandomId } from '../../utils.js';
import type { Project } from './project.model.js';

export interface ProjectRepository {
  getAll(): Project[];
  getById(id: string): Project | undefined;
  create(input: { name: string; description?: string }): Project;
  deleteById(id: string): boolean;
  exists(id: string): boolean;
}

export default fp(async (fastify: FastifyInstance) => {
  const projects: Project[] = [
    {
      id: '1',
      name: 'my first project',
    },
  ];

  const repo: ProjectRepository = {
    getAll: () => [...projects],
    getById: (id) => projects.find((p) => p.id === id),
    create: ({ name, description }) => {
      const id = getRandomId();
      const project = { id, name, description: description ?? '' };
      projects.push(project);
      return project;
    },
    deleteById: (id) => {
      const index = projects.findIndex((p) => p.id === id);
      if (index === -1) return false;
      projects.splice(index, 1);
      return true;
    },
    exists: (id) => projects.some((p) => p.id === id),
  };

  fastify.decorate('projects', repo);
});
