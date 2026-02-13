---
title: 'FormatNotLoadedError'
---

You attempted a sampling operation, but the Thymian format has not been loaded. The format is required to understand the structure of HTTP transactions and generate appropriate samples.

This error typically indicates an internal state issue where sampling is attempted before the format is ready.

If you encounter this error, it may indicate:

- A timing issue in the initialization sequence
- The format failed to load due to an earlier error
- An internal bug in the sampler plugin

Check the logs for any earlier errors that might have prevented the format from loading properly.
