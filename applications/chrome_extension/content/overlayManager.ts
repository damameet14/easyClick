/**
 * Overlay Manager
 *
 * Creates, positions, updates, and removes the floating hint labels
 * displayed on top of interactive elements during Hint Mode. Overlays
 * use glassmorphism styling for a premium, non-intrusive appearance.
 */

import { InteractiveElement } from "./elementScanner";

/* ──────────────────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────────────────── */

/** CSS class prefix to namespace all overlay elements and avoid clashes. */
const OVERLAY_CSS_CLASS_PREFIX = "easyclick-overlay";

/** ID of the container element injected into the page DOM. */
const OVERLAY_CONTAINER_ELEMENT_ID = "easyclick-overlay-container";

/** ID of the style element injected for overlay CSS. */
const OVERLAY_STYLE_ELEMENT_ID = "easyclick-overlay-styles";

/** Z-index for overlay elements to sit above all page content. */
const OVERLAY_Z_INDEX = 2147483640;

/** Pixel gap used to offset overlapping labels. */
const OVERLAP_OFFSET_INCREMENT_PIXELS = 18;

/* ──────────────────────────────────────────────────────────────────────────
   State
   ──────────────────────────────────────────────────────────────────────── */

/** Map from element unique identifier to its overlay DOM element. */
const activeOverlayElements: Map<string, HTMLElement> = new Map();

/** Reference to the injected container. */
let overlayContainerElement: HTMLElement | null = null;

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Creates and displays overlay hint labels for all provided interactive elements.
 *
 * @param interactiveElements - Elements with assigned hints to render overlays for.
 */
export function createOverlays(interactiveElements: InteractiveElement[]): void {
  injectOverlayStyles();
  ensureOverlayContainerExists();

  const occupiedPositionRegions: Array<{ left: number; top: number; right: number; bottom: number }> = [];

  for (const element of interactiveElements) {
    if (element.generatedHint.length === 0) {
      continue;
    }

    const overlayLabel = createSingleOverlayLabel(element, occupiedPositionRegions);
    activeOverlayElements.set(element.uniqueIdentifier, overlayLabel);
    overlayContainerElement!.appendChild(overlayLabel);
  }
}

/**
 * Removes all overlay elements and cleans up injected styles.
 */
export function removeAllOverlays(): void {
  for (const overlayElement of activeOverlayElements.values()) {
    overlayElement.remove();
  }
  activeOverlayElements.clear();

  if (overlayContainerElement) {
    overlayContainerElement.remove();
    overlayContainerElement = null;
  }

  const existingStyleElement = document.getElementById(OVERLAY_STYLE_ELEMENT_ID);
  if (existingStyleElement) {
    existingStyleElement.remove();
  }
}

/**
 * Updates overlays to show only hints that match the current typed input.
 * Matching overlays highlight the typed characters; non-matching overlays fade out.
 *
 * @param typedInput - The characters typed so far by the user.
 * @param interactiveElements - All interactive elements with hints.
 */
export function updateOverlaysForFilterInput(
  typedInput: string,
  interactiveElements: InteractiveElement[]
): void {
  const normalizedInput = typedInput.toLowerCase();

  for (const element of interactiveElements) {
    const overlayElement = activeOverlayElements.get(element.uniqueIdentifier);
    if (!overlayElement) {
      continue;
    }

    const hintText = element.generatedHint.toLowerCase();
    const isMatchingHint = hintText.startsWith(normalizedInput);

    if (isMatchingHint) {
      overlayElement.classList.remove(`${OVERLAY_CSS_CLASS_PREFIX}--faded`);
      overlayElement.classList.add(`${OVERLAY_CSS_CLASS_PREFIX}--active`);
      renderHighlightedHintText(overlayElement, element.generatedHint, normalizedInput.length);
    } else {
      overlayElement.classList.add(`${OVERLAY_CSS_CLASS_PREFIX}--faded`);
      overlayElement.classList.remove(`${OVERLAY_CSS_CLASS_PREFIX}--active`);
      overlayElement.textContent = element.generatedHint.toUpperCase();
    }
  }
}

/**
 * Resets all overlay labels to their initial unfiltered appearance.
 *
 * @param interactiveElements - All interactive elements with hints.
 */
export function resetOverlaysToUnfilteredState(interactiveElements: InteractiveElement[]): void {
  for (const element of interactiveElements) {
    const overlayElement = activeOverlayElements.get(element.uniqueIdentifier);
    if (!overlayElement) {
      continue;
    }

    overlayElement.classList.remove(`${OVERLAY_CSS_CLASS_PREFIX}--faded`);
    overlayElement.classList.remove(`${OVERLAY_CSS_CLASS_PREFIX}--active`);
    overlayElement.textContent = element.generatedHint.toUpperCase();
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Internal: Overlay Creation
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Ensures the overlay container element exists in the DOM.
 */
function ensureOverlayContainerExists(): void {
  if (overlayContainerElement && document.body.contains(overlayContainerElement)) {
    return;
  }

  overlayContainerElement = document.createElement("div");
  overlayContainerElement.id = OVERLAY_CONTAINER_ELEMENT_ID;
  overlayContainerElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: ${OVERLAY_Z_INDEX};
    pointer-events: none;
  `;
  document.body.appendChild(overlayContainerElement);
}

/**
 * Creates a single overlay label element positioned near the target element.
 * Handles overlap detection and repositioning.
 */
function createSingleOverlayLabel(
  interactiveElement: InteractiveElement,
  occupiedRegions: Array<{ left: number; top: number; right: number; bottom: number }>
): HTMLElement {
  const label = document.createElement("span");
  label.className = `${OVERLAY_CSS_CLASS_PREFIX}__label`;
  label.textContent = interactiveElement.generatedHint.toUpperCase();
  label.setAttribute("data-easyclick-hint", interactiveElement.generatedHint);

  const targetRectangle = interactiveElement.viewportBoundingRectangle;
  const { left, top } = computeNonOverlappingPosition(targetRectangle, occupiedRegions);

  label.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    z-index: ${OVERLAY_Z_INDEX + 1};
    pointer-events: none;
  `;

  /* Track this position for overlap detection */
  occupiedRegions.push({
    left,
    top,
    right: left + 30,
    bottom: top + 20,
  });

  return label;
}

/**
 * Computes a non-overlapping position for a hint label near the target element.
 * Tries top-left first, then top-right, bottom-left, and bottom-right corners.
 * If all corners overlap, applies an incremental vertical offset.
 */
function computeNonOverlappingPosition(
  targetRectangle: DOMRect,
  occupiedRegions: Array<{ left: number; top: number; right: number; bottom: number }>
): { left: number; top: number } {
  const candidatePositions = [
    { left: targetRectangle.left, top: targetRectangle.top - 16 },
    { left: targetRectangle.right - 24, top: targetRectangle.top - 16 },
    { left: targetRectangle.left, top: targetRectangle.bottom + 2 },
    { left: targetRectangle.right - 24, top: targetRectangle.bottom + 2 },
  ];

  for (const candidate of candidatePositions) {
    if (!checkPositionOverlapsOccupiedRegions(candidate, occupiedRegions)) {
      return clampPositionToViewport(candidate);
    }
  }

  /* All corners overlap — offset vertically from the default position */
  let adjustedPosition = { left: targetRectangle.left, top: targetRectangle.top - 16 };
  let offsetAttempts = 0;

  while (
    checkPositionOverlapsOccupiedRegions(adjustedPosition, occupiedRegions) &&
    offsetAttempts < 10
  ) {
    adjustedPosition = {
      left: adjustedPosition.left,
      top: adjustedPosition.top - OVERLAP_OFFSET_INCREMENT_PIXELS,
    };
    offsetAttempts++;
  }

  return clampPositionToViewport(adjustedPosition);
}

/**
 * Checks if a proposed position overlaps any occupied region.
 */
function checkPositionOverlapsOccupiedRegions(
  position: { left: number; top: number },
  occupiedRegions: Array<{ left: number; top: number; right: number; bottom: number }>
): boolean {
  const proposedRight = position.left + 28;
  const proposedBottom = position.top + 18;

  for (const region of occupiedRegions) {
    const hasHorizontalOverlap = position.left < region.right && proposedRight > region.left;
    const hasVerticalOverlap = position.top < region.bottom && proposedBottom > region.top;

    if (hasHorizontalOverlap && hasVerticalOverlap) {
      return true;
    }
  }

  return false;
}

/**
 * Clamps a position to remain within the visible viewport boundaries.
 */
function clampPositionToViewport(position: { left: number; top: number }): { left: number; top: number } {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return {
    left: Math.max(2, Math.min(position.left, viewportWidth - 32)),
    top: Math.max(2, Math.min(position.top, viewportHeight - 20)),
  };
}

/**
 * Renders hint text with matched characters highlighted in a distinct color.
 */
function renderHighlightedHintText(
  overlayElement: HTMLElement,
  fullHintText: string,
  matchedCharacterCount: number
): void {
  overlayElement.innerHTML = "";

  const matchedPortion = fullHintText.substring(0, matchedCharacterCount).toUpperCase();
  const unmatchedPortion = fullHintText.substring(matchedCharacterCount).toUpperCase();

  if (matchedPortion.length > 0) {
    const matchedSpan = document.createElement("span");
    matchedSpan.className = `${OVERLAY_CSS_CLASS_PREFIX}__matched-characters`;
    matchedSpan.textContent = matchedPortion;
    overlayElement.appendChild(matchedSpan);
  }

  if (unmatchedPortion.length > 0) {
    const unmatchedSpan = document.createElement("span");
    unmatchedSpan.className = `${OVERLAY_CSS_CLASS_PREFIX}__unmatched-characters`;
    unmatchedSpan.textContent = unmatchedPortion;
    overlayElement.appendChild(unmatchedSpan);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Internal: Style Injection
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Injects the CSS styles for overlay labels into the page.
 * Uses a dedicated <style> element to avoid polluting the host page's styles.
 */
function injectOverlayStyles(): void {
  if (document.getElementById(OVERLAY_STYLE_ELEMENT_ID)) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = OVERLAY_STYLE_ELEMENT_ID;
  styleElement.textContent = `
    .${OVERLAY_CSS_CLASS_PREFIX}__label {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 4px;
      font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
      font-size: 11px;
      font-weight: 700;
      line-height: 16px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      white-space: nowrap;
      color: #f0f4ff;
      background: rgba(15, 18, 30, 0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(100, 160, 255, 0.35);
      box-shadow:
        0 1px 4px rgba(0, 0, 0, 0.35),
        0 0 8px rgba(80, 140, 255, 0.15),
        inset 0 0.5px 0 rgba(255, 255, 255, 0.08);
      transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .${OVERLAY_CSS_CLASS_PREFIX}__label.${OVERLAY_CSS_CLASS_PREFIX}--active {
      background: rgba(10, 14, 28, 0.94);
      border-color: rgba(0, 220, 255, 0.6);
      box-shadow:
        0 1px 6px rgba(0, 0, 0, 0.4),
        0 0 14px rgba(0, 200, 255, 0.25),
        inset 0 0.5px 0 rgba(255, 255, 255, 0.1);
      transform: scale(1.08);
    }

    .${OVERLAY_CSS_CLASS_PREFIX}__label.${OVERLAY_CSS_CLASS_PREFIX}--faded {
      opacity: 0.12;
      transform: scale(0.88);
    }

    .${OVERLAY_CSS_CLASS_PREFIX}__matched-characters {
      color: #00f0ff;
      text-shadow: 0 0 6px rgba(0, 240, 255, 0.5);
    }

    .${OVERLAY_CSS_CLASS_PREFIX}__unmatched-characters {
      color: #b0c4e8;
    }
  `;

  document.head.appendChild(styleElement);
}
