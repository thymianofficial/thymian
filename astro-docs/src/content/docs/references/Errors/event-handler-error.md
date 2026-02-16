---
title: 'EventHandlerError'
---

## The Cause

An error occurred while executing an event handler. This error wraps the underlying error that was thrown by your event handler code.

Event handlers are functions that respond to Thymian events. When an error occurs in your handler, it's caught and wrapped in this error type to provide context about where the error occurred.

## The Solution

To debug this error:

1. **Check the error cause**: The original error is available in the `cause` property and will show you what went wrong in your handler and is available if Thymian is running in debug mode.

2. **Review your event handler code**: Look at the handler function for the specific event mentioned in the error message

3. **Add error handling**: Consider adding try-catch blocks in your event handlers for better error handling
