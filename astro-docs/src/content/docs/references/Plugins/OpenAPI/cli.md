---
title: 'CLI Reference'
description: 'Command-line tool for reading and interacting with OpenAPI specifications'
sidebar:
  order: -50
---

# Commands

  <!-- commands -->

- [`thymian openapi:info CONTENT`](#thymian-openapiinfo-content)
- [`thymian openapi:load CONTENT`](#thymian-openapiload-content)
- [`thymian openapi:validate FILE`](#thymian-openapivalidate-file)

## `thymian openapi:info CONTENT`

Load and parse the given Swagger/OpenAPI file to the Thymian format.

```
USAGE
  $ thymian openapi:info CONTENT [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...]
    [--option key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback]

ARGUMENTS
  CONTENT  file to read

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/plugin-openapi] Set current working
                 directory.

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
  Load and parse the given Swagger/OpenAPI file to the Thymian format.

EXAMPLES
  $ thymian openapi:info openapi.yaml
```

## `thymian openapi:load CONTENT`

Load and parse the given Swagger/OpenAPI file to the Thymian format.

```
USAGE
  $ thymian openapi:load CONTENT [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...]
    [--option key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback]

ARGUMENTS
  CONTENT  file to read

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/plugin-openapi] Set current working
                 directory.

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
  Load and parse the given Swagger/OpenAPI file to the Thymian format.

EXAMPLES
  $ thymian openapi:load openapi.yaml
```

## `thymian openapi:validate FILE`

Load and parse the given Swagger/OpenAPI file to the Thymian format.

```
USAGE
  $ thymian openapi:validate FILE [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback]

ARGUMENTS
  FILE  file to read

FLAGS
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/plugin-openapi] Set current working
                 directory.

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
  Load and parse the given Swagger/OpenAPI file to the Thymian format.

EXAMPLES
  $ thymian openapi:validate openapi.yaml
```

<!-- commandsstop -->
