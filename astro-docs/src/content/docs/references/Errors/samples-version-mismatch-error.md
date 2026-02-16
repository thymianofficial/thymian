---
title: 'SamplesVersionMismatchError'
---

## The Cause

Cannot merge sample trees that were generated with different versions of the Thymian format. Sample trees can only be merged if they're based on the same format version.

This error occurs when trying to combine samples from different versions, such as:

- Samples generated at different times with different Thymian versions
- Samples from different branches of your codebase
- Samples from different projects or configurations

## The Solution

To resolve this:

- Regenerate all samples using the same Thymian version
- Ensure all sample sources are using compatible format versions
- Don't try to merge samples from incompatible versions

If you need to combine samples from different sources, make sure they're all generated with the same version of your API format.
