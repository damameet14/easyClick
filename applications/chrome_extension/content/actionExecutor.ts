/**
 * Action Executor
 *
 * Knows how to interact with each type of interactive element when
 * the user completes a hint. Handles clicks, focus, toggles, and
 * dropdown opening.
 */

import { InteractiveElementType } from "./elementScanner";

/**
 * Executes the appropriate interaction action on the given element
 * based on its classified interaction type.
 *
 * @param element - The DOM element to interact with.
 * @param interactionType - The classified type of the element.
 */
export function executeElementAction(
  element: HTMLElement,
  interactionType: InteractiveElementType
): void {
  switch (interactionType) {
    case "button":
      executeClickAction(element);
      break;

    case "link":
      executeClickAction(element);
      break;

    case "input":
      executeFocusAction(element);
      break;

    case "textarea":
      executeFocusAction(element);
      break;

    case "select":
      executeSelectDropdownAction(element);
      break;

    case "checkbox":
      executeToggleAction(element);
      break;

    case "radio":
      executeClickAction(element);
      break;

    case "toggle":
      executeToggleAction(element);
      break;

    case "menu":
      executeClickAction(element);
      break;

    case "unknown":
      executeClickAction(element);
      break;
  }
}

/**
 * Clicks the element. Scrolls it into view first if necessary.
 */
function executeClickAction(element: HTMLElement): void {
  scrollElementIntoViewIfNeeded(element);
  element.focus({ preventScroll: true });
  element.click();
}

/**
 * Focuses the element and selects its text content if it's a text input.
 */
function executeFocusAction(element: HTMLElement): void {
  scrollElementIntoViewIfNeeded(element);
  element.focus({ preventScroll: true });

  /* Select all text in text inputs for easy overwriting */
  const inputElement = element as HTMLInputElement;
  if (typeof inputElement.select === "function") {
    try {
      inputElement.select();
    } catch {
      /* Some input types (e.g. date) may not support select() */
    }
  }
}

/**
 * Toggles a checkbox or switch element.
 */
function executeToggleAction(element: HTMLElement): void {
  scrollElementIntoViewIfNeeded(element);

  const inputElement = element as HTMLInputElement;
  if (inputElement.type === "checkbox") {
    inputElement.checked = !inputElement.checked;
    dispatchChangeEvent(inputElement);
    dispatchInputEvent(inputElement);
  } else {
    /* ARIA switch or custom toggle — just click it */
    element.click();
  }
}

/**
 * Opens a select dropdown by focusing and dispatching a mousedown event.
 * Prioritizes Chrome-compatible behavior per user requirement.
 */
function executeSelectDropdownAction(element: HTMLElement): void {
  scrollElementIntoViewIfNeeded(element);
  element.focus({ preventScroll: true });

  /* Dispatch a mousedown event to trigger the native dropdown in Chrome */
  const mouseDownEvent = new MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(mouseDownEvent);

  /* Follow up with a click for frameworks that listen on click */
  const clickEvent = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(clickEvent);
}

/**
 * Scrolls the element into the visible viewport if it's partially hidden.
 */
function scrollElementIntoViewIfNeeded(element: HTMLElement): void {
  const rectangle = element.getBoundingClientRect();
  const isFullyVisible =
    rectangle.top >= 0 &&
    rectangle.left >= 0 &&
    rectangle.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rectangle.right <= (window.innerWidth || document.documentElement.clientWidth);

  if (!isFullyVisible) {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }
}

/**
 * Dispatches a native `change` event on an element to notify frameworks.
 */
function dispatchChangeEvent(element: HTMLElement): void {
  const changeEvent = new Event("change", { bubbles: true, cancelable: false });
  element.dispatchEvent(changeEvent);
}

/**
 * Dispatches a native `input` event on an element to notify frameworks.
 */
function dispatchInputEvent(element: HTMLElement): void {
  const inputEvent = new Event("input", { bubbles: true, cancelable: false });
  element.dispatchEvent(inputEvent);
}
