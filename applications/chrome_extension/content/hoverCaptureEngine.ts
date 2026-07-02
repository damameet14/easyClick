/**
 * Hover Capture Engine
 *
 * Provides a UI mode where the user can hover over elements, see them outlined,
 * and click them to explicitly save a shortcut hint.
 */

import { scanInteractiveElements } from "./elementScanner";
import { rememberHint } from "./memoryManager";
import { InteractiveElement } from "./elementScanner";

let isCaptureModeActive = false;
let captureOverlay: HTMLDivElement | null = null;
let currentHoveredElement: InteractiveElement | null = null;
let candidateElements: InteractiveElement[] = [];

/**
 * Activates the hover capture mode.
 */
export function activateHoverCaptureMode(): void {
  if (isCaptureModeActive) return;
  isCaptureModeActive = true;

  // Scan all interactables to know what can be hovered
  candidateElements = scanInteractiveElements("all");

  createCaptureOverlay();
  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeyDown, true);
}

/**
 * Deactivates the hover capture mode.
 */
export function deactivateHoverCaptureMode(): void {
  if (!isCaptureModeActive) return;
  isCaptureModeActive = false;

  removeCaptureOverlay();
  document.removeEventListener("mousemove", handleMouseMove, true);
  document.removeEventListener("click", handleClick, true);
  document.removeEventListener("keydown", handleKeyDown, true);
  currentHoveredElement = null;
  candidateElements = [];
}

function createCaptureOverlay(): void {
  captureOverlay = document.createElement("div");
  captureOverlay.id = "easyclick-capture-overlay";
  captureOverlay.style.position = "fixed";
  captureOverlay.style.top = "0";
  captureOverlay.style.left = "0";
  captureOverlay.style.width = "100vw";
  captureOverlay.style.height = "100vh";
  captureOverlay.style.pointerEvents = "none";
  captureOverlay.style.zIndex = "2147483647"; // Max z-index
  
  const instructionBanner = document.createElement("div");
  instructionBanner.style.position = "absolute";
  instructionBanner.style.top = "20px";
  instructionBanner.style.left = "50%";
  instructionBanner.style.transform = "translateX(-50%)";
  instructionBanner.style.background = "rgba(0, 0, 0, 0.8)";
  instructionBanner.style.color = "white";
  instructionBanner.style.padding = "10px 20px";
  instructionBanner.style.borderRadius = "8px";
  instructionBanner.style.fontFamily = "sans-serif";
  instructionBanner.style.fontWeight = "bold";
  instructionBanner.style.fontSize = "16px";
  instructionBanner.textContent = "Hover over an element and click to save. Press Esc to cancel.";
  
  captureOverlay.appendChild(instructionBanner);
  document.body.appendChild(captureOverlay);
}

function removeCaptureOverlay(): void {
  if (captureOverlay && captureOverlay.parentElement) {
    captureOverlay.parentElement.removeChild(captureOverlay);
  }
  captureOverlay = null;
}

function handleMouseMove(event: MouseEvent): void {
  if (!isCaptureModeActive) return;

  // Find the smallest bounding box containing the cursor
  let bestMatch: InteractiveElement | null = null;
  let smallestArea = Infinity;

  for (const element of candidateElements) {
    const rect = element.viewportBoundingRectangle;
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      const area = rect.width * rect.height;
      if (area < smallestArea) {
        smallestArea = area;
        bestMatch = element;
      }
    }
  }

  currentHoveredElement = bestMatch;
  drawOutline(bestMatch);
}

function drawOutline(element: InteractiveElement | null): void {
  if (!captureOverlay) return;

  // Remove existing outline
  const existingOutline = document.getElementById("easyclick-capture-outline");
  if (existingOutline) {
    existingOutline.remove();
  }

  if (!element) return;

  const rect = element.viewportBoundingRectangle;
  const outline = document.createElement("div");
  outline.id = "easyclick-capture-outline";
  outline.style.position = "absolute";
  outline.style.top = `${rect.top}px`;
  outline.style.left = `${rect.left}px`;
  outline.style.width = `${rect.width}px`;
  outline.style.height = `${rect.height}px`;
  outline.style.border = "3px solid #ff3366";
  outline.style.backgroundColor = "rgba(255, 51, 102, 0.2)";
  outline.style.boxSizing = "border-box";
  outline.style.borderRadius = "4px";
  outline.style.pointerEvents = "none";
  outline.style.transition = "all 0.1s ease-out";

  captureOverlay.appendChild(outline);
}

function handleClick(event: MouseEvent): void {
  if (!isCaptureModeActive) return;
  
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (currentHoveredElement) {
    const customHint = window.prompt(`Assign a 2-letter hint for this element:\n(Label: ${currentHoveredElement.rawSemanticLabel})`);
    
    if (customHint && customHint.trim().length > 0) {
      const hint = customHint.trim().toLowerCase();
      rememberHint(currentHoveredElement.domElement, currentHoveredElement.interactionType, currentHoveredElement.rawSemanticLabel, hint);
      alert(`Hint '${hint}' successfully saved!`);
    }
  }

  deactivateHoverCaptureMode();
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!isCaptureModeActive) return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    deactivateHoverCaptureMode();
  }
}
