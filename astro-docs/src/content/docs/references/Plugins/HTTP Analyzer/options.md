---
title: Plugin Options
description: ''
sidebar:
  order: -100
---

**Properties**

| Name                    | Type                  | Description | Required |
| ----------------------- | --------------------- | ----------- | -------- |
| [**storage**](#storage) | <nobr>`object`</nobr> |             | yes      |

**Additional Properties:** not allowed  
**Example**

```json
{
  "storage": {}
}
```

<h2 id="storage">storage: object</h2>

   
**Option 1 (alternative):**
**Properties**

| Name     | Type | Description                     | Required |
| -------- | ---- | ------------------------------- | -------- |
| **type** |      | Constant Value: `"memory"`<br/> | yes      |

**Additional Properties:** not allowed

   
**Option 2 (alternative):**
**Properties**

| Name     | Type                  | Description                     | Required |
| -------- | --------------------- | ------------------------------- | -------- |
| **type** |                       | Constant Value: `"sqlite"`<br/> | yes      |
| **path** | <nobr>`string`</nobr> |                                 | no       |

**Additional Properties:** not allowed
