---
title: 'UnsupportedContentTypeError'
---

## The Cause

Cannot generate sample data for the specified content type. No content type strategy is available to handle this media type.

Thymian supports common content types out of the box:

- `application/json`
- `text/plain`
- `application/xml`
- `image/jpeg|png|jpg`

## The Solution

If you're using a custom or less common content type, you can add a plugin that listens to the `sampler.unknown-type` action and returns a sample value for the specified content type.

If you believe this content type should be supported by default, please open an issue or contribute a content type strategy implementation.
