---
title: 'Thymian CLI Reference'
decription: 'Reference for the Thymian CLI'
sidebar:
  order: -1000
---

# Commands

  <!-- commands -->

- [`thymian config:show`](#thymian-configshow)
- [`thymian feedback`](#thymian-feedback)
- [`thymian help [COMMAND]`](#thymian-help-command)
- [`thymian http-linter:generate`](#thymian-http-lintergenerate)
- [`thymian http-linter:list`](#thymian-http-linterlist)
- [`thymian http-linter:overview`](#thymian-http-linteroverview)
- [`thymian http-linter:search`](#thymian-http-lintersearch)
- [`thymian init`](#thymian-init)
- [`thymian plugins:list`](#thymian-pluginslist)
- [`thymian run`](#thymian-run)
- [`thymian schema`](#thymian-schema)
- [`thymian serve`](#thymian-serve)
- [`thymian version`](#thymian-version)

## `thymian config:show`

Show the current Thymian configuration.

```
USAGE
  $ thymian config:show [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback] [--yaml]

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current working directory.
  --[no-]yaml    Output configuration in YAML format.

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --suppress-feedback       Suppress feedback messages from Thymian.
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show the current Thymian configuration.
```

## `thymian feedback`

```
USAGE
  $ thymian feedback [--json] [--suppress-feedback]

GLOBAL FLAGS
  --json  Format output as json.

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.
```

## `thymian help [COMMAND]`

Display help for thymian.

```
USAGE
  $ thymian help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for thymian.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.37/src/commands/help.ts)_

## `thymian http-linter:generate`

```
USAGE
  $ thymian http-linter:generate [--json] [--suppress-feedback] [--cjs] [--prefix <value>] [--url <value>]

FLAGS
  --cjs             Generate HTTP linter rule for CommonJs.
  --prefix=<value>  Prefix for the rule name that is automatically added.
  --url=<value>     Url for the rule.

GLOBAL FLAGS
  --json  Format output as json.

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.
```

## `thymian http-linter:list`

List all loaded rules.

```
USAGE
  $ thymian http-linter:list [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback] [--rules <value>...]

FLAGS
  --cwd=<value>       [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-pl
                      ugin-architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current working
                      directory.
  --rules=<value>...  [default: ] Rules or rule sets to include.

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --suppress-feedback       Suppress feedback messages from Thymian.
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List all loaded rules.
```

## `thymian http-linter:overview`

Show a more detailed overview of all loaded rules.

```
USAGE
  $ thymian http-linter:overview [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current working directory.

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --suppress-feedback       Suppress feedback messages from Thymian.
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Show a more detailed overview of all loaded rules.
```

## `thymian http-linter:search`

```
USAGE
  $ thymian http-linter:search --for <value> [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...]
    [--option key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback] [--rules <value>...]

FLAGS
  --cwd=<value>       [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-pl
                      ugin-architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current working
                      directory.
  --for=<value>       (required) Search for.
  --rules=<value>...  [default: ] Rules or rule sets to include.

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --suppress-feedback       Suppress feedback messages from Thymian.
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.
```

## `thymian init`

Initialize Thymian in your project.

```
USAGE
  $ thymian init [--json] [--suppress-feedback] [--yaml] [--cwd <value>] [--config-file <value>] [--yes]

FLAGS
  --config-file=<value>  [default: thymian.config]
  --cwd=<value>          [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core
                         -plugin-architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current
                         working directory.
  --[no-]yaml            Output configuration file in YAML format.
  --yes

GLOBAL FLAGS
  --json  Format output as json.

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.

DESCRIPTION
  Initialize Thymian in your project.

EXAMPLES
  $ thymian init
```

## `thymian plugins:list`

List all registered Thymian plugins.

```
USAGE
  $ thymian plugins:list [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current working directory.

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --suppress-feedback       Suppress feedback messages from Thymian.
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List all registered Thymian plugins.
```

## `thymian run`

Run Thymian and the corresponding plugins specified in the Thymian configuration and via CLI.

```
USAGE
  $ thymian run [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current working directory.

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --suppress-feedback       Suppress feedback messages from Thymian.
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Run Thymian and the corresponding plugins specified in the Thymian configuration and via CLI.

EXAMPLES
  $ thymian run
```

## `thymian schema`

```
USAGE
  $ thymian schema [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current working directory.

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --suppress-feedback       Suppress feedback messages from Thymian.
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.
```

## `thymian serve`

Run Thymian in serve mode.

```
USAGE
  $ thymian serve [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback]

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/thymian] Set current working directory.

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --suppress-feedback       Suppress feedback messages from Thymian.
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Run Thymian in serve mode.

EXAMPLES
  $ thymian serve
```

## `thymian version`

```
USAGE
  $ thymian version [--json] [--verbose]

FLAGS
  --verbose  Show additional information about the CLI.

GLOBAL FLAGS
  --json  Format output as json.

FLAG DESCRIPTIONS
  --verbose  Show additional information about the CLI.

    Additionally shows the architecture, node version, operating system, and versions of plugins that the CLI is using.
```

_See code: [@oclif/plugin-version](https://github.com/oclif/plugin-version/blob/v2.2.36/src/commands/version.ts)_

<!-- commandsstop -->
