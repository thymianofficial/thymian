---
title: Plugin Options
description: Configuration options for the OpenAPI plugin
sidebar:
  order: -100
---

**Properties**

| Name                              | Type                    | Description | Required |
| --------------------------------- | ----------------------- | ----------- | -------- |
| [**descriptions**](#descriptions) | <nobr>`object[]`</nobr> |             |          |

**Additional Properties:** not allowed  
**Example**

```json
{
  "descriptions": [
    {
      "serverInfo": {}
    }
  ]
}
```

<a name="descriptions"></a>

## descriptions\[\]: array

**Items**

**Item Properties**

| Name                                      | Type                  | Description | Required |
| ----------------------------------------- | --------------------- | ----------- | -------- |
| **source**                                | <nobr>`string`</nobr> |             | yes      |
| **sourceName**                            | <nobr>`string`</nobr> |             | no       |
| [**serverInfo**](#descriptionsserverinfo) | <nobr>`object`</nobr> |             | yes      |

**Item Additional Properties:** not allowed  
**Example**

```json
[
  {
    "serverInfo": {}
  }
]
```

<a name="descriptionsserverinfo"></a>

### descriptions\[\]\.serverInfo: object

**Properties**

| Name         | Type                   | Description                    | Required |
| ------------ | ---------------------- | ------------------------------ | -------- |
| **basePath** | <nobr>`string`</nobr>  |                                | yes      |
| **port**     | <nobr>`integer`</nobr> |                                | yes      |
| **host**     | <nobr>`string`</nobr>  |                                | yes      |
| **protocol** | <nobr>`string`</nobr>  | Enum: `"http"`, `"https"`<br/> | yes      |
