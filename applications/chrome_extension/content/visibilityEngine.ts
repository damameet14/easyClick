/**
 * Visibility Engine
 *
 * Determines whether an HTML element is currently visible, enabled,
 * and interactable within the viewport. Used by the element scanner
 * to filter out hidden, disabled, or offscreen elements before
 * hint generation.
 */

/** Minimum element dimension in pixels to be considered interactable. */
const MINIMUM_INTERACTABLE_DIMENSION_PIXELS = 4;

/** Opacity threshold below which an element is considered invisible. */
const MINIMUM_VISIBLE_OPACITY_THRESHOLD = 0.05;

/**
 * Checks whether a given element is currently visible and interactable
 * within the browser viewport.
 *
 * An element is considered visible when:
 * - It has a non-zero bounding rect that intersects the viewport.
 * - Its computed style does not hide it (display:none, visibility:hidden, opacity ≈ 0).
 * - It is not disabled or aria-disabled.
 *
 * @param element - The HTML element to check.
 * @returns `true` if the element is visible and interactable.
 */
export function checkIsElementVisibleAndInteractable(element: HTMLElement): boolean {
  if (checkIsElementDisabled(element)) {
    return false;
  }

  const boundingRectangle = element.getBoundingClientRect();

  if (!checkIsBoundingRectangleWithinViewport(boundingRectangle)) {
    return false;
  }

  if (!checkIsBoundingRectangleLargeEnough(boundingRectangle)) {
    return false;
  }

  if (!checkIsElementStyleVisible(element)) {
    return false;
  }

  return true;
}

/**
 * Checks if the element's bounding rectangle intersects the viewport.
 */
function checkIsBoundingRectangleWithinViewport(rectangle: DOMRect): boolean {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return (
    rectangle.bottom > 0 &&
    rectangle.right > 0 &&
    rectangle.left < viewportWidth &&
    rectangle.top < viewportHeight
  );
}

/**
 * Checks if the bounding rectangle has sufficient dimensions to be interactive.
 */
function checkIsBoundingRectangleLargeEnough(rectangle: DOMRect): boolean {
  return (
    rectangle.width >= MINIMUM_INTERACTABLE_DIMENSION_PIXELS &&
    rectangle.height >= MINIMUM_INTERACTABLE_DIMENSION_PIXELS
  );
}

/**
 * Checks if the element's computed style allows it to be visible.
 * Filters out display:none, visibility:hidden, and near-zero opacity.
 * Also walks up ancestor chain to catch parent-hidden elements.
 */
function checkIsElementStyleVisible(element: HTMLElement): boolean {
  let currentElement: HTMLElement | null = element;

  while (currentElement !== null) {
    const computedStyle = window.getComputedStyle(currentElement);

    if (computedStyle.display === "none") {
      return false;
    }

    if (computedStyle.visibility === "hidden" || computedStyle.visibility === "collapse") {
      return false;
    }

    const parsedOpacity = parseFloat(computedStyle.opacity);
    if (!isNaN(parsedOpacity) && parsedOpacity < MINIMUM_VISIBLE_OPACITY_THRESHOLD) {
      return false;
    }

    currentElement = currentElement.parentElement;
  }

  return true;
}

/**
 * Checks whether an element is disabled via the `disabled` attribute
 * or `aria-disabled="true"`.
 */
function checkIsElementDisabled(element: HTMLElement): boolean {
  if ("disabled" in element && (element as HTMLInputElement).disabled) {
    return true;
  }

  if (element.getAttribute("aria-disabled") === "true") {
    return true;
  }

  return false;
}
