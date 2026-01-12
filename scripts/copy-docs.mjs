#!/usr/bin/env node

import fs from 'node:fs/promises';

import { execSync } from 'child_process';

async function exists(path) {
  try {
    await fs.access(path, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

const targetTags = ['scope:plugin', 'type:lib'];
// get all projects with the specified tags. We need separate calls to nx because chaining tags in one call combines them with OR, but we need AND.
const targetProjectPaths = targetTags
  .map((tag) => execSync(`nx show projects -p tag:${tag}`).toString().split('\n'))
  .reduce((projects1, projects2) => projects1.filter(p => projects2.includes(p)))
  .filter(project => project.trim() !== '')
  .map(project => JSON.parse(execSync(`nx show project ${project} --json`).toString()).root);

const pluginsDocPath = 'astro-docs/src/content/docs/plugins';

for await (const projectPath of targetProjectPaths) {
  const folderName = projectPath.split('/').pop();
  if (await exists(`${pluginsDocPath}/${folderName}`)) {
    await fs.rm(`${pluginsDocPath}/${folderName}`, {
      recursive: true,
      force: true,
    });
  }
  if (await exists(`${projectPath}/docs`)) {
    await fs.cp(`${projectPath}/docs`, `${pluginsDocPath}/${folderName}`, { recursive: true });
  }
}
