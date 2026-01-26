# Thymian

Add resilience and HTTP conformance to your API development workflow. Thymian is a lightweight, language-agnostic library that helps you build robust APIs.

## Getting Started

You want to try out Thymian? Run the following commands in the specific order:

- `npm i`
- `nx build cli`
- `npx tsx shared/test-utils/src/example-app/server.ts`
- `cd cli`
- `./bin/run.js run -o @thymian/openapi.filePath=../shared/test-utils/src/example-app/example-app.openapi.yaml -p test/fixtures/my-thymian-plugin.js`

## local publish

1. Start verdaccio: `npm run local-registry`
2. Publish to local registry: `npx nx release publish --registry http://localhost:4873` or `npm run local-publish`

## How to run and build the astro documentation

Don't call astro targets directly but always use the nx commands!

- run: `nx run astro:serve`
- build: `nx run astro:build`

## Documentation Guidelines

There are different kinds of documentation:

- [Architecture documentation](docs/arc42/README.md): Here you find the architecture documentation of Thymian. If you make any kind of decisions that are hard to change and have a long-lasting impact, document them here.
- [Astro documentation](astro-docs/README.md): The astro documentation is available as a website to the users. It contains general information about Thymian, How-To's and reference documentation for the plugins and the CLI. Add any kind of End-User documentation here (except for plugins, see next point).
- Plugin documentation: The plugin documentation is part of the astro documentation. It is located in `docs` folders in the plugin projects but will be added to the astro documentation during the build process.
- Subproject READMEs: You have technical documentation that is subproject-specific? Put it into the README of the subproject.

## Documentation

For comprehensive documentation, visit [Thymian Documentation](https://thymian.dev/).
