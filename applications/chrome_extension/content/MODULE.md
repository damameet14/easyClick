# Content Script Modules

## Module purpose

Scans web pages for interactive elements, generates semantic keyboard hints, renders visual overlays, and handles keyboard input to execute user-selected actions — enabling mouse-free navigation of any website.

## Owned responsibilities

- Detecting all visible interactive elements on a page.
- Extracting semantic labels from elements using prioritized attribute sources.
- Generating unique, ergonomic, human-readable keyboard hints.
- Rendering and managing floating overlay labels with premium styling.
- Capturing keyboard input during hint mode and filtering hints progressively.
- Executing the appropriate action (click, focus, toggle, dropdown) on matched elements.
- Observing DOM mutations, scroll, and resize events to keep overlays current.

## Responsibilities not owned

- Extension lifecycle and message relay (owned by background/serviceWorker).
- User preferences and configuration persistence (owned by options/).
- Extension popup UI (owned by popup/).

## Public operations

### `activateHintMode` (contentScript.ts)

- Trigger: `Ctrl+Alt` or `Ctrl+;` keydown event.
- Side effects: Scans page, generates hints, creates overlays, starts keyboard listening.

### `deactivateHintMode` (contentScript.ts)

- Trigger: Escape key, successful hint match, or re-pressing activation shortcut.
- Side effects: Removes overlays, stops keyboard listening, disconnects observers.

## Internal responsibility map

```text
contentScript.ts       — Entry point and hint-mode lifecycle orchestration
elementScanner.ts      — DOM querying for interactive element candidates
visibilityEngine.ts    — Viewport and computed-style visibility checks
semanticExtractor.ts   — Priority-based semantic label extraction
hintGenerator.ts       — Candidate generation, scoring, and unique assignment
overlayManager.ts      — Overlay DOM creation, styling, positioning, and filtering
keyboardEngine.ts      — Keystroke capture, filtering, and execution trigger
actionExecutor.ts      — Element-specific action dispatch (click, focus, toggle)
```

## Dependencies and side effects

- DOM APIs: `querySelectorAll`, `getBoundingClientRect`, `getComputedStyle`, `MutationObserver`.
- Injects temporary `<style>` and `<div>` overlay elements into the host page (removed on deactivation).
- Attaches temporary event listeners for keydown, scroll, and resize.

## Invariants

- Overlays must never shift or alter the host page layout.
- All injected DOM elements and styles must be removed when hint mode exits.
- No two elements may receive the same hint within a single scan cycle.
- Hint mode keystrokes must not propagate to the host page.

## Tests

- Unit tests for visibility engine, semantic extractor, and hint generator can run in a JSDOM or mocked DOM environment.
- Integration testing via manual Chrome extension loading.
