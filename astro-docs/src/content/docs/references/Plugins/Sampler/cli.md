---
title: 'CLI Reference'
description: 'Command-line tool for providing test data for interacting with API implementations'
sidebar:
  order: -50
---

# Commands

  <!-- commands -->

- [`thymian sampler:hooks:generate`](#thymian-samplerhooksgenerate)
- [`thymian sampler:init`](#thymian-samplerinit)

## `thymian sampler:hooks:generate`

```
USAGE
  $ thymian sampler:hooks:generate [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback] [--for-transaction <value>]

FLAGS
  --cwd=<value>              [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-
                             core-plugin-architecture-foundations-in-the-brownfield-repository/packages/plugin-sampler]
                             Set current working directory.
  --for-transaction=<value>  For which transaction do you want to generate a hook?

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

ALIASES
  $ thymian sampler:hooks:g
  $ thymian sampler:h:g
```

## `thymian sampler:init`

```
USAGE
  $ thymian sampler:init [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--suppress-feedback] [--overwrite] [--check]

FLAGS
  --[no-]check   After initialization, run a format check to verify all transactions can be executed.
  --cwd=<value>  [default: /Users/matthias/Thymian/thymian-internal/.worktrees/story-209-1-1-establish-goal-core-plugin-
                 architecture-foundations-in-the-brownfield-repository/packages/plugin-sampler] Set current working
                 directory.
  --overwrite    Overwrite existing samples.

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

<!-- commandsstop -->
