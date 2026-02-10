---
title: 'CLI Reference'
description: 'Command-line tools for managing HTTP linting rules'
sidebar:
  order: -50
---

The HTTP linter provides CLI commands for generating, listing, searching, and managing rules. These commands help you work efficiently with rules during development.

# Commands

  <!-- commands -->

- [`thymian http-linter:generate`](#thymian-http-lintergenerate)
- [`thymian http-linter:list`](#thymian-http-linterlist)
- [`thymian http-linter:overview`](#thymian-http-linteroverview)
- [`thymian http-linter:search`](#thymian-http-lintersearch)

## `thymian http-linter:generate`

```
USAGE
  $ thymian http-linter:generate [--cjs] [--prefix <value>] [--url <value>]

FLAGS
  --cjs             Generate HTTP linter rule for CommonJs.
  --prefix=<value>  Prefix for the rule name that is automatically added.
  --url=<value>     Url for the rule.
```

## `thymian http-linter:list`

List all loaded rules.

```
USAGE
  $ thymian http-linter:list [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...] [--option
    key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--rules <value>...]

FLAGS
  --cwd=<value>       [default: /Users/petermuller/dev/thymian/thymian/packages/http-linter] Set current working
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
    filter:value...]

FLAGS
  --cwd=<value>  [default: /Users/petermuller/dev/thymian/thymian/packages/http-linter] Set current working directory.

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

DESCRIPTION
  Show a more detailed overview of all loaded rules.
```

## `thymian http-linter:search`

```
USAGE
  $ thymian http-linter:search --for <value> [--json] [--verbose] [--config <value>] [--autoload] [--plugin <value>...]
    [--option key=value...] [--timeout <value>] [--idle-timeout <value>] [--trace-events] [--cwd <value>] [--filter
    filter:value...] [--rules <value>...]

FLAGS
  --cwd=<value>       [default: /Users/petermuller/dev/thymian/thymian/packages/http-linter] Set current working
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
  --timeout=<value>         [default: 10000] Set the duration in ms to wait for anything that happens in Thymian.
  --trace-events            All events that are emitted will be logged.
  --verbose                 Run thymian in debug mode.

GLOBAL FLAGS
  --json  Format output as json.
```

<!-- commandsstop -->
