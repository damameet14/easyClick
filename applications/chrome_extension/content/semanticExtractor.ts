/**
 * Semantic Extractor
 *
 * Extracts the best human-readable semantic label from an HTML element
 * by checking a prioritized list of content sources. The extracted label
 * is used by the hint generator to produce meaningful, memorable shortcuts.
 */

/**
 * Maximum character length for a semantic label before truncation.
 * Labels beyond this length are trimmed to keep hint generation efficient.
 */
const MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH = 80;

/**
 * Priority-ordered list of extraction strategies. Each strategy
 * attempts to pull a semantic label from a specific element attribute
 * or property. The first strategy that returns a non-empty string wins.
 */
const SEMANTIC_EXTRACTION_STRATEGIES: Array<(element: HTMLElement) => string> = [
  extractVisibleTextContent,
  extractAriaLabel,
  extractTitleAttribute,
  extractPlaceholderAttribute,
  extractValueAttribute,
  extractAltAttribute,
  extractNameAttribute,
  extractIdAttribute,
  extractDataAttributes,
];

/**
 * Extracts the most descriptive semantic label available from the given element.
 *
 * Iterates through the extraction strategies in priority order and returns
 * the first non-empty result, normalized and trimmed.
 *
 * @param element - The HTML element to extract a label from.
 * @returns An object containing both the raw extracted string and its normalized form.
 */
export function extractSemanticLabel(element: HTMLElement): { raw: string; normalized: string } {
  for (const extractionStrategy of SEMANTIC_EXTRACTION_STRATEGIES) {
    const extractedText = extractionStrategy(element);
    const normalizedText = normalizeExtractedText(extractedText);

    if (normalizedText.length > 0) {
      return { raw: extractedText.trim(), normalized: normalizedText };
    }
  }

  return { raw: "", normalized: "" };
}

/**
 * Extracts the direct visible text content of an element.
 * Avoids pulling text from deeply nested children to prevent noise.
 */
function extractVisibleTextContent(element: HTMLElement): string {
  /* For inputs and textareas, visible text is not in textContent */
  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return "";
  }

  const directTextContent = element.textContent?.trim() ?? "";

  /* If the text is extremely long (e.g. a div wrapping a paragraph),
     it's probably not a concise label — skip it. */
  if (directTextContent.length > MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH * 2) {
    /* Try innerText which respects CSS visibility */
    const innerTextContent = element.innerText?.trim() ?? "";
    if (innerTextContent.length <= MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH * 2) {
      return innerTextContent;
    }
    return "";
  }

  return directTextContent;
}

/**
 * Extracts the `aria-label` attribute value, or resolves `aria-labelledby`
 * to the referenced element's text content.
 */
function extractAriaLabel(element: HTMLElement): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim().length > 0) {
    return ariaLabel.trim();
  }

  const ariaLabelledByIdentifier = element.getAttribute("aria-labelledby");
  if (ariaLabelledByIdentifier) {
    const labellingElement = document.getElementById(ariaLabelledByIdentifier);
    if (labellingElement) {
      return labellingElement.textContent?.trim() ?? "";
    }
  }

  return "";
}

/**
 * Extracts the `title` attribute value.
 */
function extractTitleAttribute(element: HTMLElement): string {
  return element.getAttribute("title")?.trim() ?? "";
}

/**
 * Extracts the `placeholder` attribute value (for inputs and textareas).
 */
function extractPlaceholderAttribute(element: HTMLElement): string {
  return (element as HTMLInputElement).placeholder?.trim() ?? "";
}

/**
 * Extracts the `value` attribute value (for input buttons and submit inputs).
 */
function extractValueAttribute(element: HTMLElement): string {
  const inputElement = element as HTMLInputElement;
  const inputType = inputElement.type?.toLowerCase();

  /* Only extract value for button-like inputs where value is the label */
  if (inputType === "submit" || inputType === "button" || inputType === "reset") {
    return inputElement.value?.trim() ?? "";
  }

  return "";
}

/**
 * Extracts the `alt` attribute value (primarily for images inside links/buttons).
 */
function extractAltAttribute(element: HTMLElement): string {
  /* Check the element itself */
  const altValue = element.getAttribute("alt")?.trim() ?? "";
  if (altValue.length > 0) {
    return altValue;
  }

  /* Check child images */
  const childImage = element.querySelector("img[alt]");
  if (childImage) {
    return childImage.getAttribute("alt")?.trim() ?? "";
  }

  return "";
}

/**
 * Extracts the `name` attribute value.
 */
function extractNameAttribute(element: HTMLElement): string {
  return element.getAttribute("name")?.trim() ?? "";
}

/**
 * Extracts the `id` attribute value and humanizes it by converting
 * camelCase, snake_case, and kebab-case to space-separated words.
 */
function extractIdAttribute(element: HTMLElement): string {
  const idValue = element.id?.trim() ?? "";
  if (idValue.length === 0) {
    return "";
  }

  return humanizeIdentifier(idValue);
}

/**
 * Extracts useful text from `data-*` attributes.
 * Prioritizes common descriptive data attributes.
 */
function extractDataAttributes(element: HTMLElement): string {
  const prioritizedDataAttributeNames = [
    "data-label",
    "data-tooltip",
    "data-title",
    "data-name",
    "data-action",
    "data-testid",
    "data-test-id",
  ];

  for (const attributeName of prioritizedDataAttributeNames) {
    const attributeValue = element.getAttribute(attributeName)?.trim() ?? "";
    if (attributeValue.length > 0) {
      return humanizeIdentifier(attributeValue);
    }
  }

  return "";
}

/**
 * Normalizes extracted text for hint generation.
 * - Converts to lowercase
 * - Removes emojis and special symbols
 * - Removes excess whitespace
 * - Truncates to maximum length
 */
function normalizeExtractedText(rawText: string): string {
  if (!rawText || rawText.trim().length === 0) {
    return "";
  }

  let normalized = rawText.toLowerCase();

  /* Remove emojis and non-letter/non-number/non-space characters */
  normalized = normalized.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");

  /* Remove punctuation except hyphens and underscores (useful for humanization) */
  normalized = normalized.replace(/[^\w\s-]/g, " ");

  /* Collapse whitespace */
  normalized = normalized.replace(/\s+/g, " ").trim();

  /* Truncate */
  if (normalized.length > MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH) {
    normalized = normalized.substring(0, MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH).trim();
  }

  return normalized;
}

/**
 * Converts identifiers (camelCase, snake_case, kebab-case) to
 * space-separated lowercase words.
 *
 * Examples:
 *   "saveButton" → "save button"
 *   "save-draft-btn" → "save draft btn"
 *   "user_profile" → "user profile"
 */
function humanizeIdentifier(identifier: string): string {
  return identifier
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
