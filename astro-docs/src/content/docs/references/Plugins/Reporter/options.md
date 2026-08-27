---
title: Plugin Options
description: ''
sidebar:
  order: -100
---

**Properties**

| Name                          | Type                  | Description                                                                                                                                                                                               | Required |
| ----------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [**formatters**](#formatters) | <nobr>`object`</nobr> | Configuration for different report formatters<br/>                                                                                                                                                        |          |
| **sortReportsBy**             | <nobr>`string`</nobr> | How report findings are grouped (rule, endpoint, or severity). Normally set from the --sort-reports-by CLI flag; affects the markdown formatter only.<br/>Enum: `"rule"`, `"endpoint"`, `"severity"`<br/> |          |

**Additional Properties:** not allowed   
**Example**

```json
{
  "formatters": {
    "markdown": {},
    "csv": {},
    "json": {}
  }
}
```

<h2 id="formatters">formatters: object</h2>

**Properties**

| Name                                | Type                  | Description                                                                                                  | Required |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| [**markdown**](#formattersmarkdown) | <nobr>`object`</nobr> | Configuration for the Markdown formatter<br/>                                                                |          |
| [**csv**](#formatterscsv)           | <nobr>`object`</nobr> | Configuration for the CSV formatter<br/>                                                                     |          |
| [**json**](#formattersjson)         | <nobr>`object`</nobr> | Configuration for the JSON formatter, which writes the canonical report payload for machine consumption<br/> |          |

**Additional Properties:** not allowed   
**Example**

```json
{
  "markdown": {},
  "csv": {},
  "json": {}
}
```

<h3 id="formatterscsv">formatters.csv: object</h3>

**Properties**

| Name     | Type                  | Description                                       | Required |
| -------- | --------------------- | ------------------------------------------------- | -------- |
| **path** | <nobr>`string`</nobr> | File path where the CSV report will be saved<br/> |          |

**Additional Properties:** not allowed 
<h3 id="formattersjson">formatters.json: object</h3>

**Properties**

| Name     | Type                  | Description                                        | Required |
| -------- | --------------------- | -------------------------------------------------- | -------- |
| **path** | <nobr>`string`</nobr> | File path where the JSON report will be saved<br/> |          |

**Additional Properties:** not allowed 
<h3 id="formattersmarkdown">formatters.markdown: object</h3>

**Properties**

| Name     | Type                  | Description                                            | Required |
| -------- | --------------------- | ------------------------------------------------------ | -------- |
| **path** | <nobr>`string`</nobr> | File path where the markdown report will be saved<br/> |          |

**Additional Properties:** not allowed 
