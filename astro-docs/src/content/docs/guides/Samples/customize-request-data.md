---
title: How to customize Request Data
description: Learn how to modify generated request samples
---

Sometimes the automatically generated samples are not sufficient for your use case. `@thymian/sampler` lets you customize the generated samples
by modifying the request data files directly or adding multiple test cases.

## Step 1: Locate the Request Sample

Navigate to the endpoint you want to customize:

```bash
cd .thymian/samples/YourAPI/.../endpoint/requests/
ls
# Output: 0-request.json
```

## Step 2: Edit Inline Values

Open `0-request.json` and modify values directly:

**Before:**

```json
{
  "body": {
    "email": "user@example.com",
    "age": 25
  }
}
```

**After:**

```json
{
  "body": {
    "email": "alice@test.com",
    "age": 30
  }
}
```

## Step 3: Add Multiple Samples

Create additional sample files for different test cases:

```bash
cp 0-request.json 1-request.json
cp 0-request.json 2-request.json
```

Edit each file with different data:

**1-request.json** (edge case - minimum values):

```json
{
  "body": {
    "email": "min@test.com",
    "age": 18
  }
}
```

**2-request.json** (edge case - maximum values):

```json
{
  "body": {
    "email": "max@test.com",
    "age": 120
  }
}
```

### Step 4: Use File References for Large Data

For large payloads, use external files:

```bash
echo '{"large": "payload", ...}' > custom-payload.json
```

Reference it in your sample:

```json
{
  "body": {
    "$file": "custom-payload.json"
  }
}
```

Not only JSON files are supported, but any file type. For example, you could have an XML file named user.xml:

```xml
<user>
  <email></email>
  <age>25</age>
</user>
```

you can load it as follows:

```json
{
  "body": {
    "$file": "./user.xml"
  }
}
```

And also any other kind of files are supported, for example, a png file that you want to load as base64:

```json
{
  "body": {
    "$file": "./my-picture.png",
    "$encoding": "base64"
  }
}
```
