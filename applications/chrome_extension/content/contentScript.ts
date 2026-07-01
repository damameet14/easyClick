/**
 * Content Script — Entry Point
 *
 * Main entry point injected into every page. Orchestrates the hint-mode
 * lifecycle: activation shortcut detection → element scanning → hint
 * generation → overlay rendering → keyboard listening → action execution.
 *
 * Also sets up MutationObserver and scroll/resize listeners to keep
 * overlays synchronized with dynamic page changes.
 */

import { scanInteractiveElements, InteractiveElement } from "./elementScanner";
import { generateUniqueHints } from "./hintGenerator";
import { createOverlays, removeAllOverlays } from "./overlayManager";
import { activateKeyboardListening, deactivateKeyboardListening } from "./keyboardEngine";

/* ──────────────────────────────────────────────────────────────────────────
   State
   ──────────────────────────────────────────────────────────────────────── */

/** Whether hint mode is currently active. */
let isHintModeActive = false;

/** The interactive elements from the most recent scan. */
let currentInteractiveElements: InteractiveElement[] = [];

/** MutationObserver for tracking DOM changes during hint mode. */
let activeDomMutationObserver: MutationObserver | null = null;

/** Throttle timer ID for scroll/resize re-evaluation. */
let scrollResizeThrottleTimerId: ReturnType<typeof setTimeout> | null = null;

/** Minimum interval between scroll/resize re-evaluations in ms. */
const SCROLL_RESIZE_THROTTLE_INTERVAL_MILLISECONDS = 200;

/* ──────────────────────────────────────────────────────────────────────────
   Activation Shortcut Detection
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Activation shortcut detection.
 *
 * Primary:   Ctrl + .  (most reliable across all platforms)
 * Secondary: Ctrl + ;
 * Tertiary:  Ctrl + Alt (detected via modifier key tracking — may be
 *            unreliable on Windows where Ctrl+Alt maps to AltGr)
 *
 * For Ctrl+Alt, we track modifier state manually and detect when:
 *   - Alt is pressed while Ctrl is already held, OR
 *   - Ctrl is pressed while Alt is already held.
 * A non-modifier key pressed between the two resets the tracking to
 * avoid false triggers.
 */
let isControlKeyCurrentlyHeld = false;
let isAltKeyCurrentlyHeld = false;
let wasNonModifierKeyPressedDuringModifierSequence = false;

document.addEventListener("keydown", (event: KeyboardEvent) => {
  /* Track modifier key state */
  if (event.key === "Control") {
    isControlKeyCurrentlyHeld = true;
    wasNonModifierKeyPressedDuringModifierSequence = false;

    /* If Alt is already held, this completes the Ctrl+Alt combo */
    if (isAltKeyCurrentlyHeld) {
      event.preventDefault();
      toggleHintMode();
      return;
    }
    return;
  }

  if (event.key === "Alt") {
    isAltKeyCurrentlyHeld = true;
    wasNonModifierKeyPressedDuringModifierSequence = false;

    /* If Ctrl is already held, this completes the Ctrl+Alt combo */
    if (isControlKeyCurrentlyHeld) {
      event.preventDefault();
      toggleHintMode();
      return;
    }
    return;
  }

  /* Mark that a non-modifier key was pressed (invalidates Ctrl+Alt sequence) */
  if (event.key !== "Shift" && event.key !== "Meta") {
    wasNonModifierKeyPressedDuringModifierSequence = true;
  }

  /* Ctrl + . (period) — primary activation shortcut */
  if (event.key === "." && event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toggleHintMode();
    return;
  }

  /* Ctrl + ; — secondary activation shortcut */
  if (event.key === ";" && event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toggleHintMode();
    return;
  }
}, true);

document.addEventListener("keyup", (event: KeyboardEvent) => {
  if (event.key === "Control") {
    isControlKeyCurrentlyHeld = false;
  }
  if (event.key === "Alt") {
    isAltKeyCurrentlyHeld = false;
  }
}, true);

/**
 * Shows a brief, non-intrusive toast to confirm the content script loaded.
 * Fades out automatically after 2 seconds.
 */
function showContentScriptLoadedToast(): void {
  const toast = document.createElement("div");
  toast.textContent = "⌨ EasyClick ready — Press Ctrl + . to activate";
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    padding: 10px 18px;
    border-radius: 8px;
    font-family: 'Segoe UI', -apple-system, sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #e6edf3;
    background: rgba(15, 18, 30, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(100, 160, 255, 0.3);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 12px rgba(80, 140, 255, 0.15);
    pointer-events: none;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  `;
  document.body.appendChild(toast);

  /* Animate in */
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  /* Fade out and remove after 2.5 seconds */
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 350);
  }, 2500);
}

/* ──────────────────────────────────────────────────────────────────────────
   Hint Mode Lifecycle
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Toggles hint mode on or off.
 */
function toggleHintMode(): void {
  if (isHintModeActive) {
    deactivateHintMode();
  } else {
    activateHintMode();
  }
}

/**
 * Activates hint mode:
 * 1. Scans the page for interactive elements.
 * 2. Generates semantic hints for each element.
 * 3. Renders overlay labels.
 * 4. Starts keyboard listening for hint input.
 * 5. Attaches dynamic page observers.
 */
function activateHintMode(): void {
  if (isHintModeActive) {
    return;
  }

  isHintModeActive = true;

  /* Step 1: Scan for interactive elements */
  currentInteractiveElements = scanInteractiveElements();

  if (currentInteractiveElements.length === 0) {
    isHintModeActive = false;
    return;
  }

  /* Step 2: Generate unique hints */
  generateUniqueHints(currentInteractiveElements);

  /* Step 3: Render overlays */
  createOverlays(currentInteractiveElements);

  /* Step 4: Start keyboard listening */
  activateKeyboardListening(currentInteractiveElements, deactivateHintMode);

  /* Step 5: Attach dynamic observers */
  attachDynamicPageObservers();

  console.log(`[EasyClick] Hint mode activated. ${currentInteractiveElements.length} elements scanned.`);
}

/**
 * Deactivates hint mode:
 * 1. Stops keyboard listening.
 * 2. Removes all overlays.
 * 3. Detaches dynamic observers.
 * 4. Clears state.
 */
function deactivateHintMode(): void {
  if (!isHintModeActive) {
    return;
  }

  isHintModeActive = false;

  /* Step 1: Stop keyboard engine */
  deactivateKeyboardListening();

  /* Step 2: Remove overlays */
  removeAllOverlays();

  /* Step 3: Detach observers */
  detachDynamicPageObservers();

  /* Step 4: Clear state */
  currentInteractiveElements = [];

  console.log("[EasyClick] Hint mode deactivated.");
}

/* ──────────────────────────────────────────────────────────────────────────
   Dynamic Page Observers
   ──────────────────────────────────────────────────────────────────────── */

/**
 * The ID of the overlay container injected by overlayManager.
 * Used to filter out self-inflicted DOM mutations.
 */
const OVERLAY_CONTAINER_ELEMENT_ID = "easyclick-overlay-container";
const OVERLAY_STYLE_ELEMENT_ID = "easyclick-overlay-styles";

/**
 * Attaches MutationObserver and scroll/resize event listeners to
 * re-evaluate visible elements when the page changes during hint mode.
 */
function attachDynamicPageObservers(): void {
  /* MutationObserver for DOM changes — filters out our own overlay mutations */
  activeDomMutationObserver = new MutationObserver((mutationRecords: MutationRecord[]) => {
    if (!isHintModeActive) {
      return;
    }

    /* Check if any mutation originated outside our overlay container */
    const overlayContainer = document.getElementById(OVERLAY_CONTAINER_ELEMENT_ID);

    const hasPageMutationOutsideOverlay = mutationRecords.some((mutationRecord) => {
      const mutationTarget = mutationRecord.target as HTMLElement;

      /* Ignore mutations inside our overlay container */
      if (overlayContainer && (mutationTarget === overlayContainer || overlayContainer.contains(mutationTarget))) {
        return false;
      }

      /* Ignore mutations to our injected style element */
      if (mutationTarget instanceof HTMLElement && mutationTarget.id === OVERLAY_STYLE_ELEMENT_ID) {
        return false;
      }

      return true;
    });

    if (!hasPageMutationOutsideOverlay) {
      return;
    }

    /* Throttle actual regeneration to avoid performance issues */
    if (scrollResizeThrottleTimerId !== null) {
      return;
    }

    scrollResizeThrottleTimerId = setTimeout(() => {
      scrollResizeThrottleTimerId = null;
      if (isHintModeActive) {
        regenerateHintsAndOverlays();
      }
    }, SCROLL_RESIZE_THROTTLE_INTERVAL_MILLISECONDS);
  });

  activeDomMutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "disabled", "aria-disabled", "hidden"],
  });

  /* Scroll and resize listeners */
  window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });
  window.addEventListener("resize", handleScrollOrResize, { passive: true });
}

/**
 * Detaches all dynamic page observers.
 */
function detachDynamicPageObservers(): void {
  if (activeDomMutationObserver) {
    activeDomMutationObserver.disconnect();
    activeDomMutationObserver = null;
  }

  window.removeEventListener("scroll", handleScrollOrResize, true);
  window.removeEventListener("resize", handleScrollOrResize);

  if (scrollResizeThrottleTimerId !== null) {
    clearTimeout(scrollResizeThrottleTimerId);
    scrollResizeThrottleTimerId = null;
  }
}

/**
 * Handles scroll or resize events with throttling.
 */
function handleScrollOrResize(): void {
  if (!isHintModeActive) {
    return;
  }

  if (scrollResizeThrottleTimerId !== null) {
    return;
  }

  scrollResizeThrottleTimerId = setTimeout(() => {
    scrollResizeThrottleTimerId = null;
    if (isHintModeActive) {
      regenerateHintsAndOverlays();
    }
  }, SCROLL_RESIZE_THROTTLE_INTERVAL_MILLISECONDS);
}

/**
 * Re-scans the page, regenerates hints, and replaces overlays.
 * Called when the page layout changes during hint mode.
 */
function regenerateHintsAndOverlays(): void {
  /* Remove existing overlays */
  removeAllOverlays();
  deactivateKeyboardListening();

  /* Re-scan and regenerate */
  currentInteractiveElements = scanInteractiveElements();

  if (currentInteractiveElements.length === 0) {
    deactivateHintMode();
    return;
  }

  generateUniqueHints(currentInteractiveElements);
  createOverlays(currentInteractiveElements);
  activateKeyboardListening(currentInteractiveElements, deactivateHintMode);
}

/* ──────────────────────────────────────────────────────────────────────────
   Utility
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Creates a throttled version of a callback that fires at most once
 * per the specified interval.
 */
function throttleCallback<T extends (...arguments_: unknown[]) => void>(
  callback: T,
  intervalMilliseconds: number
): T {
  let lastExecutionTimestamp = 0;
  let pendingTimerId: ReturnType<typeof setTimeout> | null = null;

  return ((...arguments_: unknown[]) => {
    const currentTimestamp = Date.now();
    const timeSinceLastExecution = currentTimestamp - lastExecutionTimestamp;

    if (timeSinceLastExecution >= intervalMilliseconds) {
      lastExecutionTimestamp = currentTimestamp;
      callback(...arguments_);
    } else if (pendingTimerId === null) {
      pendingTimerId = setTimeout(() => {
        lastExecutionTimestamp = Date.now();
        pendingTimerId = null;
        callback(...arguments_);
      }, intervalMilliseconds - timeSinceLastExecution);
    }
  }) as T;
}

/* ──────────────────────────────────────────────────────────────────────────
   Initialization
   ──────────────────────────────────────────────────────────────────────── */

console.log("[EasyClick] Content script loaded. Press Ctrl+. or Ctrl+; to activate hint mode.");
showContentScriptLoadedToast();

