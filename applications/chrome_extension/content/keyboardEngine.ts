/**
 * Keyboard Engine
 *
 * Manages the keyboard interaction lifecycle during Hint Mode.
 * Captures keystrokes, progressively filters visible hints,
 * and triggers action execution when a unique match is found.
 */

import { InteractiveElement } from "./elementScanner";
import {
  updateOverlaysForFilterInput,
  resetOverlaysToUnfilteredState,
} from "./overlayManager";
import { executeElementAction } from "./actionExecutor";
import { rememberHint } from "./memoryManager";

/* ──────────────────────────────────────────────────────────────────────────
   State
   ──────────────────────────────────────────────────────────────────────── */

/** The characters typed so far during the current hint-mode session. */
let currentTypedInput = "";

/** Whether hint mode is currently active and listening for keystrokes. */
let isHintModeCurrentlyActive = false;

/** The current set of interactive elements being filtered. */
let currentInteractiveElements: InteractiveElement[] = [];

/** Callback to invoke when hint mode should be deactivated. */
let onHintModeDeactivationCallback: (() => void) | null = null;

/** Reference to the bound keydown handler for cleanup. */
let boundKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Activates the keyboard engine to listen for hint-mode keystrokes.
 * Defocuses any active text input to prevent keystroke conflicts.
 *
 * @param interactiveElements - The elements with assigned hints to filter through.
 * @param onDeactivation - Callback invoked when hint mode should exit (escape, completion, etc.)
 */
export function activateKeyboardListening(
  interactiveElements: InteractiveElement[],
  onDeactivation: () => void
): void {
  if (isHintModeCurrentlyActive) {
    return;
  }

  currentInteractiveElements = interactiveElements;
  onHintModeDeactivationCallback = onDeactivation;
  currentTypedInput = "";
  isHintModeCurrentlyActive = true;

  /* Defocus active text inputs to prevent keystroke interference */
  defocusActiveTextInputElement();

  /* Attach keydown listener */
  boundKeydownHandler = handleHintModeKeydown;
  document.addEventListener("keydown", boundKeydownHandler, true);
}

/**
 * Deactivates the keyboard engine and cleans up all listeners.
 */
export function deactivateKeyboardListening(): void {
  if (!isHintModeCurrentlyActive) {
    return;
  }

  isHintModeCurrentlyActive = false;
  currentTypedInput = "";
  currentInteractiveElements = [];

  if (boundKeydownHandler) {
    document.removeEventListener("keydown", boundKeydownHandler, true);
    boundKeydownHandler = null;
  }

  onHintModeDeactivationCallback = null;
}

/**
 * Returns true if the user has started typing a hint.
 * Used to prevent disruptive page re-scans while the user is actively filtering.
 */
export function isUserActivelyTyping(): boolean {
  return currentTypedInput.length > 0;
}

/* ──────────────────────────────────────────────────────────────────────────
   Internal: Keyboard Handling
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Handles keydown events during hint mode.
 * - Letters: Append to input buffer and filter hints.
 * - Backspace: Remove last character from input buffer.
 * - Escape: Exit hint mode.
 * - All other keys: Ignored (not consumed).
 */
function handleHintModeKeydown(event: KeyboardEvent): void {
  if (!isHintModeCurrentlyActive) {
    return;
  }

  /* Ignore modifier-only keypresses */
  if (event.key === "Control" || event.key === "Alt" || event.key === "Shift" || event.key === "Meta") {
    return;
  }

  /* Escape: exit hint mode */
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    requestHintModeDeactivation();
    return;
  }

  /* Backspace: remove last character */
  if (event.key === "Backspace") {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    handleBackspaceKeypress();
    return;
  }

  /* Only handle single alphabetic characters */
  if (event.key.length === 1 && /^[a-zA-Z]$/.test(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    handleAlphabeticKeypress(event.key.toLowerCase());
    return;
  }
}

/**
 * Handles an alphabetic keypress by appending to the input buffer,
 * updating overlay filters, and auto-executing if a unique match is found.
 */
function handleAlphabeticKeypress(character: string): void {
  currentTypedInput += character;

  /* Update overlay visuals */
  updateOverlaysForFilterInput(currentTypedInput, currentInteractiveElements);

  /* Find elements whose hints match the current input */
  const matchingElements = currentInteractiveElements.filter((element) =>
    element.generatedHint.toLowerCase().startsWith(currentTypedInput)
  );

  /* No matches: flash feedback and remove last character */
  if (matchingElements.length === 0) {
    currentTypedInput = currentTypedInput.slice(0, -1);
    updateOverlaysForFilterInput(currentTypedInput, currentInteractiveElements);
    return;
  }

  /* Exact match: execute the action */
  const exactMatchElement = matchingElements.find(
    (element) => element.generatedHint.toLowerCase() === currentTypedInput
  );

  if (exactMatchElement) {
    /* Remember successful hint mapping */
    if (exactMatchElement.semanticLabel) {
      rememberHint(exactMatchElement.semanticLabel, exactMatchElement.generatedHint);
    }

    /* Brief visual delay before executing for user feedback */
    setTimeout(() => {
      executeElementAction(exactMatchElement.domElement, exactMatchElement.interactionType);
      requestHintModeDeactivation();
    }, 80);
    return;
  }

  /* Multiple matches remain or typed input is a prefix: keep listening */
}

/**
 * Handles the Backspace key by removing the last typed character and
 * refreshing the overlay filter state.
 */
function handleBackspaceKeypress(): void {
  if (currentTypedInput.length === 0) {
    return;
  }

  currentTypedInput = currentTypedInput.slice(0, -1);

  if (currentTypedInput.length === 0) {
    resetOverlaysToUnfilteredState(currentInteractiveElements);
  } else {
    updateOverlaysForFilterInput(currentTypedInput, currentInteractiveElements);
  }
}

/**
 * Requests hint mode deactivation through the registered callback.
 */
function requestHintModeDeactivation(): void {
  if (onHintModeDeactivationCallback) {
    onHintModeDeactivationCallback();
  }
}

/**
 * Defocuses any currently focused text input or textarea element
 * to prevent hint-mode keystrokes from being typed into form fields.
 */
function defocusActiveTextInputElement(): void {
  const activeElement = document.activeElement as HTMLElement | null;

  if (!activeElement) {
    return;
  }

  const tagName = activeElement.tagName.toLowerCase();
  const isTextInput =
    tagName === "input" ||
    tagName === "textarea" ||
    activeElement.getAttribute("contenteditable") === "true" ||
    activeElement.getAttribute("contenteditable") === "";

  if (isTextInput) {
    activeElement.blur();
  }
}
