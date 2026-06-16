---
title: Configuration Schema
description: Auto-generated from the Thymian config JSON schema.
---

**Properties**

| Name                                  | Type                    | Description                                                                                                                                                                  | Required |
| ------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **autoload**                          | <nobr>`boolean`</nobr>  | Enables automatic plugin loading from `plugins`.<br/>Default: `true`<br/>                                                                                                    | no       |
| **logLevel**                          | <nobr>`string`</nobr>   | Controls CLI log verbosity.<br/>Default: `"warn"`<br/>Enum: `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`, `"silent"`<br/>                                             | no       |
| [**specifications**](#specifications) | <nobr>`object[]`</nobr> | API descriptions to load (usually OpenAPI files).<br/>Default: <br/>                                                                                                         | no       |
| [**traffic**](#traffic)               | <nobr>`object[]`</nobr> | Recorded traffic inputs used by `thymian analyze`.<br/>Default: <br/>                                                                                                        | no       |
| [**ruleSets**](#rulesets)             | <nobr>`string[]`</nobr> | Rule set packages to load.<br/>Default: `"@thymian/rules-rfc-9110"`, `"@thymian/rules-api-description-validation"`<br/>                                                      | no       |
| **ruleSeverity**                      | <nobr>`string`</nobr>   | Minimum rule severity threshold.<br/>Default: `"error"`<br/>Enum: `"off"`, `"error"`, `"warn"`, `"hint"`<br/>                                                                | no       |
| **targetUrl**                         | <nobr>`string`</nobr>   | Base URL used for live API testing workflows. When set, all requests are sent to this origin instead of the servers defined in the specification.<br/>                       | no       |
| [**rules**](#rules)                   | <nobr>`object`</nobr>   | Per-rule configuration/overrides. Each key is a rule ID. The value can be a severity string (`off \| error \| warn \| hint`) or a rule config object.<br/>Default: `{}`<br/> | no       |
| [**plugins**](#plugins)               | <nobr>`object`</nobr>   | Plugin registrations and plugin options. This is the only required top-level key.<br/>                                                                                       | yes      |

**Additional Properties:** not allowed  
**Example**

```json
{
  "autoload": true,
  "logLevel": "warn",
  "specifications": [],
  "traffic": [],
  "ruleSets": ["@thymian/rules-rfc-9110", "@thymian/rules-api-description-validation"],
  "ruleSeverity": "error",
  "rules": {},
  "plugins": {}
}
```

<h2 id="specifications">specifications[]: array</h2>

**Items**

**Item Properties**

| Name                                  | Type                  | Description                                       | Required |
| ------------------------------------- | --------------------- | ------------------------------------------------- | -------- |
| **type**                              | <nobr>`string`</nobr> | Specification format, for example `openapi`.<br/> | yes      |
| **location**                          |                       | File path or supported path source.<br/>          | yes      |
| [**options**](#specificationsoptions) | <nobr>`object`</nobr> | Specification-specific options.<br/>              | no       |

**Item Additional Properties:** not allowed

<h3 id="specificationsoptions">specifications[].options: object</h3>

**Additional Properties:** allowed

<h2 id="traffic">traffic[]: array</h2>

**Items**

**Item Properties**

| Name                           | Type                  | Description                                        | Required |
| ------------------------------ | --------------------- | -------------------------------------------------- | -------- |
| **type**                       | <nobr>`string`</nobr> | Traffic source format, for example `fixture`.<br/> | yes      |
| **location**                   |                       | File path or supported path source.<br/>           | yes      |
| [**options**](#trafficoptions) | <nobr>`object`</nobr> | Traffic-specific options.<br/>                     | no       |

**Item Additional Properties:** not allowed

<h3 id="trafficoptions">traffic[].options: object</h3>

**Additional Properties:** allowed

<h2 id="rulesets">ruleSets[]: array</h2>

**Items**

**Item Type:** <nobr>`string`</nobr>  
**Example**

```json
["@thymian/rules-rfc-9110", "@thymian/rules-api-description-validation"]
```

<h2 id="rules">rules: object</h2>

**Additional Properties**

| Name                      | Type | Description | Required |
| ------------------------- | ---- | ----------- | -------- |
| **Additional Properties** |      |             |          |

<h2 id="plugins">plugins: object</h2>

**Additional Properties**

| Name                                                      | Type                  | Description | Required |
| --------------------------------------------------------- | --------------------- | ----------- | -------- |
| [**Additional Properties**](#pluginsadditionalproperties) | <nobr>`object`</nobr> |             |          |

<h3 id="pluginsadditionalproperties">plugins.additionalProperties: object</h3>

**Properties**

| Name                                               | Type                   | Description                                                                                                    | Required |
| -------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| **path**                                           | <nobr>`string`</nobr>  | Explicit module/file path.<br/>                                                                                |          |
| **verbose**                                        | <nobr>`boolean`</nobr> | Enable verbose logging for this plugin.<br/>                                                                   |          |
| **autoload**                                       | <nobr>`boolean`</nobr> | When set to `false`, this plugin is skipped even though it is listed under `plugins`.<br/>Default: `true`<br/> |          |
| [**options**](#pluginsadditionalpropertiesoptions) | <nobr>`object`</nobr>  | Plugin-specific options.<br/>                                                                                  |          |

**Additional Properties:** not allowed  
**Example**

```json
{
  "autoload": true,
  "options": {}
}
```

<h4 id="pluginsadditionalpropertiesoptions">plugins.additionalProperties.options: object</h4>

**Additional Properties:** allowed
