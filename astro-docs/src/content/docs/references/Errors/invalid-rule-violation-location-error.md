---
title: 'InvalidRuleViolationLocationError'
---

## The Cause

A rule reported a violation with a location that references a non-existent element in the Thymian format. This typically indicates a bug in the rule implementation.

The location can reference either:

- A node (HTTP request or response) via its ID
- An edge (HTTP transaction) via its ID

This is usually caused by:

- The rule using an incorrect element ID
- The format being modified after the rule collected the element ID
- A bug in the rule implementation

## The Solution

If you're developing a rule, ensure you're using valid element IDs from the current format state. If you're a user encountering this error, please report it as a bug.
