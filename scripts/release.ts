import { ReleaseClient } from 'nx/release/index.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

(async () => {
  const argv = await yargs(hideBin(process.argv))
    .version(false)
    .option('version', {
      description:
        'Explicit version specifier to use, if overriding conventional commits',
      type: 'string',
    })
    .option('dryRun', {
      alias: 'd',
      description:
        'Whether or not to perform a dry-run of the release process, defaults to true',
      type: 'boolean',
      default: true,
    })
    .option('firstRelease', {
      description: 'Treat this as the first release for the workspace/projects',
      type: 'boolean',
      default: false,
    })
    .option('verbose', {
      description: 'Whether or not to enable verbose logging, defaults to true',
      type: 'boolean',
      default: true,
    })
    .option('local', {
      description:
        'Whether to use local registry (http://localhost:4873), defaults to true',
      type: 'boolean',
      default: true,
    })
    .parseAsync();

  const client = new ReleaseClient({});

  const { workspaceVersion, projectsVersionData, releaseGraph } =
    await client.releaseVersion({
      specifier: argv.version,
      dryRun: argv.dryRun,
      firstRelease: argv.firstRelease,
      verbose: argv.verbose,
    });

  //   await client.releaseChangelog({
  //     releaseGraph,
  //     versionData: projectsVersionData,
  //     version: workspaceVersion,
  //     dryRun: argv.dryRun,
  //     firstRelease: argv.firstRelease,
  //     verbose: argv.verbose,
  //   });

  // const publishResults = await client.releasePublish({
  //   releaseGraph,
  //   dryRun: argv.dryRun,
  //   firstRelease: argv.firstRelease,
  //   verbose: argv.verbose,
  //   access: 'restricted', // publish privately for now
  //   registry: argv.local ? 'http://localhost:4873' : undefined,
  // });

  process.exit(
    Object.values(publishResults).every((result) => result.code === 0) ? 0 : 1,
  );
})();
