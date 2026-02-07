---
title: 'CLI Reference'
description: 'Command-line tool for validating API implementation against API specifications'
sidebar:
  order: -50
---

# Commands

  <!-- commands -->

- [`thymian format:check`](#thymian-formatcheck)
- [`thymian format:validate`](#thymian-formatvalidate)
- [`thymian request`](#thymian-request)

## `thymian format:check`

```
USAGE
  $ thymian format:check [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--incremental]

FLAGS
  --cwd=<value>       [default: /Users/petermuller/dev/thymian/thymian/packages/format-validator] Set current working
                      directory.
  --[no-]incremental

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.
```

## `thymian format:validate`

```
USAGE
  $ thymian format:validate [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/format-validator] Set current working
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
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.
```

## `thymian request`

```
USAGE
  $ thymian request [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--validate]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/format-validator] Set current working
                 directory.
  --validate

BASE FLAGS
  --[no-]autoload           Disable automatic loading and initialization of plugins based on configuration file.
  --config=<value>          [default: thymian.config.yaml] Path to thymian configuration file.
  --filter=filter:value...  Filter transactions by properties. Use multiple times for AND. Available filters:
                            methodstatusCoderesponseHeaderrequestHeaderpathportprotocoloriginauthorizationresponseMediaT
                            yperequestMediaType
  --idle-timeout=<value>    [default: 500] Set the duration in ms to waited for events and actions when closing Thymian.
  --option=key=value...     Override configuration values for plugins.
  --plugin=<value>...       [default: ]
  --timeout=<value>         [default: 1000] Set the duration in ms to wait until a plugin is registered.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.
```

<!-- commandsstop -->
