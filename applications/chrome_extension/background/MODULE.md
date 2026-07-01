# Background Service Worker

## Module purpose

Handles Chrome extension lifecycle events (install, update) and provides a message-passing interface between popup/options pages and content scripts.

## Owned responsibilities

- Responding to extension install and update events.
- Relaying messages between extension UI surfaces and content scripts.

## Responsibilities not owned

- Page scanning and hint generation (owned by content script modules).
- Overlay rendering (owned by overlayManager in content/).
- Keyboard event handling (owned by keyboardEngine in content/).

## Public operations

### `onMessage: GET_EXTENSION_STATUS`

- Request contract: `{ type: "GET_EXTENSION_STATUS" }`
- Success result: `{ isActive: boolean, version: string }`
- Failure result: None
- Side effects: None

## Internal responsibility map

```text
serviceWorker.ts — Extension lifecycle handling and message relay
```

## Dependencies and side effects

- `chrome.runtime` API for lifecycle and messaging.

## Tests

- Not applicable for V1 (lifecycle events are trivial).
