---
title: 'Thymian CLI Reference'
decription: 'Reference for the Thymian CLI'
sidebar:
  order: -1000
---

# Commands

<!-- commands -->

- [`thymian analyze`](#thymian-analyze)
- [`thymian config show`](#thymian-config-show)
- [`thymian feedback`](#thymian-feedback)
- [`thymian generate config`](#thymian-generate-config)
- [`thymian generate rule`](#thymian-generate-rule)
- [`thymian help [COMMAND]`](#thymian-help-command)
- [`thymian lint`](#thymian-lint)
- [`thymian plugins list`](#thymian-plugins-list)
- [`thymian request`](#thymian-request)
- [`thymian rules list`](#thymian-rules-list)
- [`thymian serve`](#thymian-serve)
- [`thymian test`](#thymian-test)
- [`thymian validate`](#thymian-validate)
- [`thymian version`](#thymian-version)

## `thymian analyze`

Analyze recorded API traffic against specifications and configured rule sets.

```
USAGE
  $ thymian analyze [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs]
    [--validate-traffic-source]

FLAGS
  --cwd=<value>                   [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plu
                                  gin-execution-data/packages/thymian] Set current working directory.
  --[no-]validate-traffic-source  Validate included traffic sources and fail on source-schema validation errors.

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
  Analyze recorded API traffic against specifications and configured rule sets.

EXAMPLES
  $ thymian analyze

  $ thymian analyze --traffic har:./traffic.har

  $ thymian analyze --spec openapi:./openapi.yaml --traffic har:./traffic.har
```

_See code: [dist/commands/analyze.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/analyze.js)_

## `thymian config show`

Show the current Thymian configuration.

```
USAGE
  $ thymian config show [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs] [--yaml]

FLAGS
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/thymian] Set current working directory.
  --[no-]yaml    Output configuration in YAML format.

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
  Show the current Thymian configuration.
```

_See code: [dist/commands/config/show.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/config/show.js)_

## `thymian feedback`

Share CLI feedback or report the most recent command error.

```
USAGE
  $ thymian feedback [--suppress-feedback]

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.

DESCRIPTION
  Share CLI feedback or report the most recent command error.
```

_See code: [dist/commands/feedback.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/feedback.js)_

## `thymian generate config`

Generate a Thymian configuration file for one or more API specifications.

```
USAGE
  $ thymian generate config [--suppress-feedback] [--cwd <value>] [--interactive] [--output <value>] [--for-spec
    type:location...]

FLAGS
  --cwd=<value>                [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin
                               -execution-data/packages/thymian] Set current working directory.
  --for-spec=type:location...  Specification input in the format <type>:<location>. Skips auto-detection and adds each
                               provided specification directly.
  --[no-]interactive           Run in interactive mode. Use --no-interactive for automation.
  --output=<value>             Output path for the generated configuration file. Defaults to thymian.config.yaml in the
                               working directory.

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.

DESCRIPTION
  Generate a Thymian configuration file for one or more API specifications.

EXAMPLES
  $ thymian generate config

  $ thymian generate config --no-interactive

  $ thymian generate config --output my-api.config.yaml

  $ thymian generate config --for-spec openapi:./petstore.yaml

  $ thymian generate config --for-spec openapi:./petstore.yaml --for-spec openapi:./orders.yaml
```

_See code: [dist/commands/generate/config.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/generate/config.js)_

## `thymian generate rule`

Scaffold a new HTTP rule using the httpRule builder.

```
USAGE
  $ thymian generate rule [--suppress-feedback] [--cjs] [--prefix <value>] [--url <value>] [--output <value>]
    [--cwd <value>]

FLAGS
  --cjs             Generate rule using CommonJS syntax.
  --cwd=<value>     [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-
                    data/packages/thymian] Set current working directory.
  --output=<value>  Write the generated rule to a file instead of printing to stdout.
  --prefix=<value>  Prefix for the rule name that is automatically prepended.
  --url=<value>     Reference URL for the rule.

BASE FLAGS
  --suppress-feedback  Suppress feedback messages from Thymian.

DESCRIPTION
  Scaffold a new HTTP rule using the httpRule builder.

EXAMPLES
  $ thymian generate rule

  $ thymian generate rule --prefix my-org/

  $ thymian generate rule --cjs

  $ thymian generate rule --output src/rules/my-rule.rule.ts
```

_See code: [dist/commands/generate/rule.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/generate/rule.js)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/6.2.45/src/commands/help.ts)_

## `thymian lint`

Lint API specifications against configured rule sets.

```
USAGE
  $ thymian lint [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs]

FLAGS
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/thymian] Set current working directory.

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
  Lint API specifications against configured rule sets.

EXAMPLES
  $ thymian lint

  $ thymian lint --spec openapi:./openapi.yaml

  $ thymian lint --rule-set @thymian/rules-rfc-9110
```

_See code: [dist/commands/lint.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/lint.js)_

## `thymian plugins list`

List all registered Thymian plugins.

```
USAGE
  $ thymian plugins list [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs]

FLAGS
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/thymian] Set current working directory.

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
  List all registered Thymian plugins.
```

_See code: [dist/commands/plugins/list.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/plugins/list.js)_

## `thymian request`

```
USAGE
  $ thymian request [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs] [--validate]

FLAGS
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/thymian] Set current working directory.
  --validate

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
```

_See code: [dist/commands/request.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/request.js)_

## `thymian rules list`

List all rules from the configured rule sets.

```
USAGE
  $ thymian rules list [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs] [--type
    static|analytics|test|informational...] [--to-csv <value>]

FLAGS
  --cwd=<value>       [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-executio
                      n-data/packages/thymian] Set current working directory.
  --to-csv=<value>    Output rules to CSV file.
  --type=<option>...  Filter rules by type (static, analytics, test, informational). Can be specified multiple times.
                      <options: static|analytics|test|informational>

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
  List all rules from the configured rule sets.

EXAMPLES
  $ thymian rules list

  $ thymian rules list --rule-set @thymian/rules-rfc-9110

  $ thymian rules list --rule-severity hint

  $ thymian rules list --type static
```

_See code: [dist/commands/rules/list.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/rules/list.js)_

## `thymian serve`

Run Thymian in serve mode.

```
USAGE
  $ thymian serve [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs]

FLAGS
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/thymian] Set current working directory.

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
  Run Thymian in serve mode.

EXAMPLES
  $ thymian serve
```

_See code: [dist/commands/serve.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/serve.js)_

## `thymian test`

Test API specifications by running live requests against configured rule sets.

```
USAGE
  $ thymian test [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs] [--target-url
    <value>]

FLAGS
  --cwd=<value>         [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execut
                        ion-data/packages/thymian] Set current working directory.
  --target-url=<value>  Override the target URL for all test requests. When set, all requests are sent to this origin
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
  Test API specifications by running live requests against configured rule sets.

EXAMPLES
  $ thymian test

  $ thymian test --spec openapi:./openapi.yaml

  $ thymian test --rule-set @thymian/rules-rfc-9110

  $ thymian test --target-url http://localhost:8080
```

_See code: [dist/commands/test.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/test.js)_

## `thymian validate`

Validate API specifications resolved from config or --spec.

```
USAGE
  $ thymian validate [--verbose] [--debug] [--guidance] [--log-level trace|debug|info|warn|error|silent]
    [--config <value>] [--autoload] [--plugin <value>...] [--option <plugin>.<path>=<value>...] [--spec
    type:location...] [--traffic type:location...] [--rule-set package-name...] [--rule-severity off|error|warn|hint]
    [--timeout <value>] [--idle-timeout <value>] [--cwd <value>] [--suppress-feedback] [--validate-specs]

FLAGS
  --cwd=<value>  [default: /home/andreas/Projects/thymian/thymian-internal/.worktrees/story-333-map-plugin-execution-dat
                 a/packages/thymian] Set current working directory.

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
  Validate API specifications resolved from config or --spec.

EXAMPLES
  $ thymian validate

  $ thymian validate --spec openapi:./openapi.yaml
```

_See code: [dist/commands/validate.js](https://github.com/thymianofficial/thymian/blob/v0.0.0-PLACEHOLDER/dist/commands/validate.js)_

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

_See code: [@oclif/plugin-version](https://github.com/oclif/plugin-version/blob/2.2.42/src/commands/version.ts)_

<!-- commandsstop -->
