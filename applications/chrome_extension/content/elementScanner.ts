/**
 * Element Scanner
 *
 * Scans the current page for all visible, interactive HTML elements
 * and produces an array of InteractiveElement descriptors. This is the
 * first step in the hint-mode pipeline: scan → extract → generate → overlay.
 */

import { checkIsElementVisibleAndInteractable } from "./visibilityEngine";
import { extractSemanticLabel } from "./semanticExtractor";

/**
 * Categorized type of an interactive element, used to determine
 * the appropriate action when the user selects its hint.
 */
export type InteractiveElementType =
  | "button"
  | "link"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "menu"
  | "toggle"
  | "unknown";

/**
 * Describes a single interactive element on the page, enriched with
 * semantic metadata, screen position, and the generated hint string.
 */
export interface InteractiveElement {
  /** Unique identifier for this element in the current scan cycle. */
  uniqueIdentifier: string;

  /** Reference to the actual DOM element. */
  domElement: HTMLElement;

  /** Categorized interaction type. */
  interactionType: InteractiveElementType;

  /** The exact raw string extracted from the UI (e.g. "Search...") used for exact memory matching. */
  rawSemanticLabel: string;

  /** Human-readable semantic label extracted from the element, normalized for scoring. */
  semanticLabel: string;

  /** The keyboard hint assigned by the hint generator. */
  generatedHint: string;

  /** Whether the element is currently visible in the viewport. */
  isCurrentlyVisible: boolean;

  /** Bounding rectangle of the element in viewport coordinates. */
  viewportBoundingRectangle: DOMRect;

  /** Priority score for hint assignment (lower = higher priority). */
  hintAssignmentPriority: number;
}

/**
 * CSS selector that matches all native interactive HTML elements.
 */
const NATIVE_INTERACTIVE_ELEMENTS_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "textarea",
  "select",
  "summary",
  "option",
  "label[for]",
].join(", ");

/**
 * CSS selector for ARIA role-based interactive elements.
 */
const ARIA_INTERACTIVE_ROLES_SELECTOR = [
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
].join(", ");

/**
 * CSS selector for elements made focusable via tabindex.
 */
const FOCUSABLE_TABINDEX_SELECTOR = "[tabindex]";

/**
 * CSS selector for contenteditable elements.
 */
const CONTENT_EDITABLE_SELECTOR = '[contenteditable="true"], [contenteditable=""]';

/**
 * Scans the entire page for interactive elements, filters by visibility,
 * extracts semantic labels, and returns enriched InteractiveElement descriptors.
 * @param filterType - Optional filter to restrict scanning to specific types.
 * @returns An array of InteractiveElement objects for all currently visible,
 *          interactable elements on the page.
 */
export function scanInteractiveElements(filterType: "all" | "buttons_and_links" = "all"): InteractiveElement[] {
  const candidateElements = collectCandidateElements();
  const deduplicatedElements = deduplicateElements(candidateElements);
  const interactiveElements: InteractiveElement[] = [];

  let elementIndex = 0;

  for (const domElement of deduplicatedElements) {
    if (!checkIsElementVisibleAndInteractable(domElement)) {
      continue;
    }

    const interactionType = classifyElementInteractionType(domElement);
    
    if (filterType === "buttons_and_links") {
      if (interactionType !== "button" && interactionType !== "link") {
        continue;
      }
    }
    const { raw: rawSemanticLabel, normalized: semanticLabel } = extractSemanticLabel(domElement);
    const viewportBoundingRectangle = domElement.getBoundingClientRect();
    const hintAssignmentPriority = computeElementPriority(domElement, interactionType, semanticLabel);

    interactiveElements.push({
      uniqueIdentifier: `ec-${elementIndex++}`,
      domElement,
      interactionType,
      rawSemanticLabel,
      semanticLabel,
      generatedHint: "",
      isCurrentlyVisible: true,
      viewportBoundingRectangle,
      hintAssignmentPriority,
    });
  }

  /* Sort by priority so that more important elements get better hints */
  interactiveElements.sort(
    (elementA, elementB) => elementA.hintAssignmentPriority - elementB.hintAssignmentPriority
  );

  return interactiveElements;
}

/**
 * Collects all candidate interactive elements from the DOM using
 * multiple selector strategies.
 */
function collectCandidateElements(): HTMLElement[] {
  const candidates: HTMLElement[] = [];

  /* Native interactive elements */
  const nativeElements = document.querySelectorAll<HTMLElement>(NATIVE_INTERACTIVE_ELEMENTS_SELECTOR);
  candidates.push(...Array.from(nativeElements));

  /* ARIA role-based elements */
  const ariaElements = document.querySelectorAll<HTMLElement>(ARIA_INTERACTIVE_ROLES_SELECTOR);
  candidates.push(...Array.from(ariaElements));

  /* Tabindex-focusable elements */
  const focusableElements = document.querySelectorAll<HTMLElement>(FOCUSABLE_TABINDEX_SELECTOR);
  for (const element of focusableElements) {
    const tabIndexValue = parseInt(element.getAttribute("tabindex") ?? "-1", 10);
    if (tabIndexValue >= 0) {
      candidates.push(element);
    }
  }

  /* Content-editable elements */
  const contentEditableElements = document.querySelectorAll<HTMLElement>(CONTENT_EDITABLE_SELECTOR);
  candidates.push(...Array.from(contentEditableElements));

  /* Elements with onclick attribute */
  const onclickElements = document.querySelectorAll<HTMLElement>("[onclick]");
  candidates.push(...Array.from(onclickElements));

  /* Elements with cursor:pointer that aren't already captured */
  collectCursorPointerElements(candidates);

  return candidates;
}

/**
 * Scans for elements with `cursor: pointer` computed style that may be
 * interactive but not captured by other selectors. Only checks elements
 * at a reasonable depth to avoid performance issues.
 */
function collectCursorPointerElements(existingCandidates: HTMLElement[]): void {
  const existingCandidateSet = new Set(existingCandidates);

  /* Check common container elements for cursor:pointer children */
  const potentialContainers = document.querySelectorAll<HTMLElement>(
    "div, span, li, td, th, nav, header, footer, aside, section, article"
  );

  for (const container of potentialContainers) {
    if (existingCandidateSet.has(container)) {
      continue;
    }

    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.cursor === "pointer") {
      existingCandidates.push(container);
      existingCandidateSet.add(container);
    }
  }
}

/**
 * Removes duplicate element references and aggressively filters out child elements 
 * that are fully contained within interactive parent elements (e.g., SVG inside a Button).
 */
function deduplicateElements(elements: HTMLElement[]): HTMLElement[] {
  const uniqueElementSet = new Set<HTMLElement>(elements);
  const deduplicatedList: HTMLElement[] = [];

  for (const element of uniqueElementSet) {
    let isChildOfInteractive = false;
    let current = element.parentElement;
    
    while (current && current !== document.body) {
      if (uniqueElementSet.has(current)) {
        isChildOfInteractive = true;
        break;
      }
      current = current.parentElement;
    }

    if (!isChildOfInteractive) {
      deduplicatedList.push(element);
    }
  }

  return deduplicatedList;
}

/**
 * Classifies the interaction type of an element based on its tag name,
 * input type, and ARIA role.
 */
function classifyElementInteractionType(element: HTMLElement): InteractiveElementType {
  const tagName = element.tagName.toLowerCase();
  const ariaRole = element.getAttribute("role")?.toLowerCase() ?? "";

  if (tagName === "a") return "link";
  if (tagName === "button" || ariaRole === "button") return "button";
  if (tagName === "select") return "select";
  if (tagName === "textarea") return "textarea";

  if (tagName === "input") {
    const inputType = (element as HTMLInputElement).type?.toLowerCase() ?? "text";
    if (inputType === "checkbox") return "checkbox";
    if (inputType === "radio") return "radio";
    if (inputType === "submit" || inputType === "button" || inputType === "reset") return "button";
    return "input";
  }

  if (ariaRole === "link") return "link";
  if (ariaRole === "checkbox" || ariaRole === "switch" || ariaRole === "menuitemcheckbox") return "toggle";
  if (ariaRole === "tab" || ariaRole === "menuitem" || ariaRole === "menuitemradio" || ariaRole === "option") return "menu";
  if (ariaRole === "radio") return "radio";

  if (tagName === "summary") return "button";
  if (tagName === "label") return "button";
  if (element.getAttribute("contenteditable") === "true" || element.getAttribute("contenteditable") === "") return "textarea";

  return "unknown";
}

/**
 * Computes a numeric priority for hint assignment. Lower values receive
 * better (shorter, more ergonomic) hints.
 *
 * Priority factors:
 * - Element type (buttons and links are higher priority than unknown)
 * - Viewport position (elements near the top/center are higher priority)
 * - Semantic label presence (labeled elements get higher priority)
 */
function computeElementPriority(
  element: HTMLElement,
  interactionType: InteractiveElementType,
  semanticLabel: string
): number {
  let priority = 50;

  /* Type-based priority bonus */
  const typeWeights: Record<InteractiveElementType, number> = {
    button: -20,
    link: -15,
    input: -18,
    textarea: -10,
    select: -10,
    checkbox: -8,
    radio: -8,
    toggle: -8,
    menu: -5,
    unknown: 0,
  };
  priority += typeWeights[interactionType];

  /* Semantic label bonus */
  if (semanticLabel.length > 0) {
    priority -= 10;
  }

  /* Viewport position bonus: elements near the top get slight priority */
  const rect = element.getBoundingClientRect();
  const viewportCenterY = window.innerHeight / 2;
  const distanceFromCenter = Math.abs(rect.top - viewportCenterY) / viewportCenterY;
  priority += Math.floor(distanceFromCenter * 10);

  return priority;
}
