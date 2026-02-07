---
title: Plugin Options
description: Configuration options for the OpenAPI plugin
sidebar:
  order: -100
---

**Properties**

| Name                              | Type       | Description | Required |
| --------------------------------- | ---------- | ----------- | -------- |
| [**descriptions**](#descriptions) | `object[]` |             |          |

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

| Name                                      | Type     | Description | Required |
| ----------------------------------------- | -------- | ----------- | -------- |
| **source**                                | `string` |             | yes      |
| **sourceName**                            | `string` |             | no       |
| [**serverInfo**](#descriptionsserverinfo) | `object` |             | yes      |

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

| Name         | Type      | Description                    | Required |
| ------------ | --------- | ------------------------------ | -------- |
| **basePath** | `string`  |                                | yes      |
| **port**     | `integer` |                                | yes      |
| **host**     | `string`  |                                | yes      |
| **protocol** | `string`  | Enum: `"http"`, `"https"`<br/> | yes      |
