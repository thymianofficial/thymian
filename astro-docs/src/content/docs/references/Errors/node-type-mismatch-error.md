---
title: 'NodeTypeMismatchError'
---

## The Cause

An attempt was made to merge two nodes in the samples tree, but they have different types and cannot be merged. Only nodes of the same type can be merged together.

This error occurs during sample tree merging operations when:

- Two sample trees are being combined
- The trees have different structures at the same path
- A node in one tree has a different type than the corresponding node in the other tree

## The Solution

This typically indicates an inconsistency in how samples are being generated or structured. If you encounter this error, it may indicate a bug or an incompatibility between different sample sources.
