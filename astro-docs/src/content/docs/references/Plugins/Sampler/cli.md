---
title: 'CLI Reference'
description: 'Command-line tool for providing test data for interacting with API implementations'
sidebar:
  order: -50
---

# Commands

<!-- commands -->

- [`thymian sampler check`](#thymian-sampler-check)
- [`thymian sampler generate hook`](#thymian-sampler-generate-hook)
- [`thymian sampler init`](#thymian-sampler-init)

## `thymian sampler check`

Verify that all sampled transactions can be executed against the live API.

```
USAGE
  $ thymian sampler check [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs]
    [--incremental] [--target-url <value>]

FLAGS
  --cwd=<value>         [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execut
                        ion-data/packages/plugin-sampler] Set current working directory.
  --[no-]incremental    Check transactions one by one and offer to generate hooks for failures.
  --target-url=<value>  Override the target URL for all check requests. When set, all requests are sent to this origin
                        instead of the servers defined in the specification.

BASE FLAGS
  --[no-]autoload                      Automatically load and initialize plugins from the configuration file.
  --config=<value>                     Path to thymian configuration file.
  --debug                              Run thymian in debug mode.
  --[no-]guidance                      Show guidance hints on stderr. Defaults to true for TTY, false for non-TTY.
  --idle-timeout=<value>               [default: 500] Set the duration in ms to waited for events and actions when
                                       closing Thymian.
  --log-level=<option>                 Set log level (trace, debug, info, warn, error, silent). When set to trace, all
                                       events are traced.
                                       <options: trace|debug|info|warn|error|silent>
  --option=<plugin>.<path>=<value>...  Override plugin options. Format: <pluginName>.<property.path>=<value>. Supports
                                       nested paths (dot notation) and array indices (bracket notation).
  --plugin=<value>...                  [default: ] Load an additional plugin package or relative plugin path before
                                       running the command. Can be used multiple times.
  --rule-set=package-name...           Add a rule set package to use for validation (e.g. @thymian/rules-rfc-9110). Can
                                       be specified multiple times.
  --rule-severity=<option>             Set the minimum rule severity threshold for rule loading (off, error, warn,
                                       hint). Only rules at or above this severity are loaded.
                                       <options: off|error|warn|hint>
  --spec=type:location...              Specification input in the format <type>:<location> (e.g.
                                       openapi:./openapi.yaml).
  --suppress-feedback                  Suppress feedback messages from Thymian.
  --timeout=<value>                    [default: 10000] Set the duration in ms to wait for anything that happens in
                                       Thymian.
  --traffic=type:location...           Traffic input in the format <type>:<location> (e.g. har:./traffic.har).
  --[no-]validate-specs                Validate included specifications and fail on schema validation errors.
  --verbose                            Run thymian in verbose mode.

DESCRIPTION
  Verify that all sampled transactions can be executed against the live API.

EXAMPLES
  $ thymian sampler check

  $ thymian sampler check --target-url http://localhost:8080

  $ thymian sampler check --incremental
```

_See code: [dist/cli/commands/sampler/check.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/cli/commands/sampler/check.js)_

## `thymian sampler generate hook`

Generate a sampler hook for a specific transaction.

```
USAGE
  $ thymian sampler generate hook [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs]
    [--for-transaction <value>]

FLAGS
  --cwd=<value>              [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-e
                             xecution-data/packages/plugin-sampler] Set current working directory.
  --for-transaction=<value>  Transaction identifier to generate the hook for.

BASE FLAGS
  --[no-]autoload                      Automatically load and initialize plugins from the configuration file.
  --config=<value>                     Path to thymian configuration file.
  --debug                              Run thymian in debug mode.
  --[no-]guidance                      Show guidance hints on stderr. Defaults to true for TTY, false for non-TTY.
  --idle-timeout=<value>               [default: 500] Set the duration in ms to waited for events and actions when
                                       closing Thymian.
  --log-level=<option>                 Set log level (trace, debug, info, warn, error, silent). When set to trace, all
                                       events are traced.
                                       <options: trace|debug|info|warn|error|silent>
  --option=<plugin>.<path>=<value>...  Override plugin options. Format: <pluginName>.<property.path>=<value>. Supports
                                       nested paths (dot notation) and array indices (bracket notation).
  --plugin=<value>...                  [default: ] Load an additional plugin package or relative plugin path before
                                       running the command. Can be used multiple times.
  --rule-set=package-name...           Add a rule set package to use for validation (e.g. @thymian/rules-rfc-9110). Can
                                       be specified multiple times.
  --rule-severity=<option>             Set the minimum rule severity threshold for rule loading (off, error, warn,
                                       hint). Only rules at or above this severity are loaded.
                                       <options: off|error|warn|hint>
  --spec=type:location...              Specification input in the format <type>:<location> (e.g.
                                       openapi:./openapi.yaml).
  --suppress-feedback                  Suppress feedback messages from Thymian.
  --timeout=<value>                    [default: 10000] Set the duration in ms to wait for anything that happens in
                                       Thymian.
  --traffic=type:location...           Traffic input in the format <type>:<location> (e.g. har:./traffic.har).
  --[no-]validate-specs                Validate included specifications and fail on schema validation errors.
  --verbose                            Run thymian in verbose mode.

DESCRIPTION
  Generate a sampler hook for a specific transaction.

ALIASES
  $ thymian sampler g h
  $ thymian sampler generate h
```

_See code: [dist/cli/commands/sampler/generate/hook.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/cli/commands/sampler/generate/hook.js)_

## `thymian sampler init`

Generate initial sampler files for the current API specification.

```
USAGE
  $ thymian sampler init [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs] [--overwrite]
    [--check]

FLAGS
  --[no-]check   After initialization, run sampler check to verify all transactions can be executed.
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/plugin-sampler] Set current working directory.
  --overwrite    Overwrite existing samples.

BASE FLAGS
  --[no-]autoload                      Automatically load and initialize plugins from the configuration file.
  --config=<value>                     Path to thymian configuration file.
  --debug                              Run thymian in debug mode.
  --[no-]guidance                      Show guidance hints on stderr. Defaults to true for TTY, false for non-TTY.
  --idle-timeout=<value>               [default: 500] Set the duration in ms to waited for events and actions when
                                       closing Thymian.
  --log-level=<option>                 Set log level (trace, debug, info, warn, error, silent). When set to trace, all
                                       events are traced.
                                       <options: trace|debug|info|warn|error|silent>
  --option=<plugin>.<path>=<value>...  Override plugin options. Format: <pluginName>.<property.path>=<value>. Supports
                                       nested paths (dot notation) and array indices (bracket notation).
  --plugin=<value>...                  [default: ] Load an additional plugin package or relative plugin path before
                                       running the command. Can be used multiple times.
  --rule-set=package-name...           Add a rule set package to use for validation (e.g. @thymian/rules-rfc-9110). Can
                                       be specified multiple times.
  --rule-severity=<option>             Set the minimum rule severity threshold for rule loading (off, error, warn,
                                       hint). Only rules at or above this severity are loaded.
                                       <options: off|error|warn|hint>
  --spec=type:location...              Specification input in the format <type>:<location> (e.g.
                                       openapi:./openapi.yaml).
  --suppress-feedback                  Suppress feedback messages from Thymian.
  --timeout=<value>                    [default: 10000] Set the duration in ms to wait for anything that happens in
                                       Thymian.
  --traffic=type:location...           Traffic input in the format <type>:<location> (e.g. har:./traffic.har).
  --[no-]validate-specs                Validate included specifications and fail on schema validation errors.
  --verbose                            Run thymian in verbose mode.

DESCRIPTION
  Generate initial sampler files for the current API specification.
```

_See code: [dist/cli/commands/sampler/init.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/cli/commands/sampler/init.js)_

<!-- commandsstop -->
