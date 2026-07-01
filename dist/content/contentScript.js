"use strict";
(() => {
  // applications/chrome_extension/content/visibilityEngine.ts
  var MINIMUM_INTERACTABLE_DIMENSION_PIXELS = 4;
  var MINIMUM_VISIBLE_OPACITY_THRESHOLD = 0.05;
  function checkIsElementVisibleAndInteractable(element) {
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
  function checkIsBoundingRectangleWithinViewport(rectangle) {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rectangle.bottom > 0 && rectangle.right > 0 && rectangle.left < viewportWidth && rectangle.top < viewportHeight;
  }
  function checkIsBoundingRectangleLargeEnough(rectangle) {
    return rectangle.width >= MINIMUM_INTERACTABLE_DIMENSION_PIXELS && rectangle.height >= MINIMUM_INTERACTABLE_DIMENSION_PIXELS;
  }
  function checkIsElementStyleVisible(element) {
    let currentElement = element;
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
  function checkIsElementDisabled(element) {
    if ("disabled" in element && element.disabled) {
      return true;
    }
    if (element.getAttribute("aria-disabled") === "true") {
      return true;
    }
    return false;
  }

  // applications/chrome_extension/content/semanticExtractor.ts
  var MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH = 80;
  var SEMANTIC_EXTRACTION_STRATEGIES = [
    extractVisibleTextContent,
    extractAriaLabel,
    extractTitleAttribute,
    extractPlaceholderAttribute,
    extractValueAttribute,
    extractAltAttribute,
    extractNameAttribute,
    extractIdAttribute,
    extractDataAttributes
  ];
  function extractSemanticLabel(element) {
    for (const extractionStrategy of SEMANTIC_EXTRACTION_STRATEGIES) {
      const extractedText = extractionStrategy(element);
      const normalizedText = normalizeExtractedText(extractedText);
      if (normalizedText.length > 0) {
        return normalizedText;
      }
    }
    return "";
  }
  function extractVisibleTextContent(element) {
    const tagName = element.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return "";
    }
    const directTextContent = element.textContent?.trim() ?? "";
    if (directTextContent.length > MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH * 2) {
      const innerTextContent = element.innerText?.trim() ?? "";
      if (innerTextContent.length <= MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH * 2) {
        return innerTextContent;
      }
      return "";
    }
    return directTextContent;
  }
  function extractAriaLabel(element) {
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
  function extractTitleAttribute(element) {
    return element.getAttribute("title")?.trim() ?? "";
  }
  function extractPlaceholderAttribute(element) {
    return element.placeholder?.trim() ?? "";
  }
  function extractValueAttribute(element) {
    const inputElement = element;
    const inputType = inputElement.type?.toLowerCase();
    if (inputType === "submit" || inputType === "button" || inputType === "reset") {
      return inputElement.value?.trim() ?? "";
    }
    return "";
  }
  function extractAltAttribute(element) {
    const altValue = element.getAttribute("alt")?.trim() ?? "";
    if (altValue.length > 0) {
      return altValue;
    }
    const childImage = element.querySelector("img[alt]");
    if (childImage) {
      return childImage.getAttribute("alt")?.trim() ?? "";
    }
    return "";
  }
  function extractNameAttribute(element) {
    return element.getAttribute("name")?.trim() ?? "";
  }
  function extractIdAttribute(element) {
    const idValue = element.id?.trim() ?? "";
    if (idValue.length === 0) {
      return "";
    }
    return humanizeIdentifier(idValue);
  }
  function extractDataAttributes(element) {
    const prioritizedDataAttributeNames = [
      "data-label",
      "data-tooltip",
      "data-title",
      "data-name",
      "data-action",
      "data-testid",
      "data-test-id"
    ];
    for (const attributeName of prioritizedDataAttributeNames) {
      const attributeValue = element.getAttribute(attributeName)?.trim() ?? "";
      if (attributeValue.length > 0) {
        return humanizeIdentifier(attributeValue);
      }
    }
    return "";
  }
  function normalizeExtractedText(rawText) {
    if (!rawText || rawText.trim().length === 0) {
      return "";
    }
    let normalized = rawText.toLowerCase();
    normalized = normalized.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
    normalized = normalized.replace(/[^\w\s-]/g, " ");
    normalized = normalized.replace(/\s+/g, " ").trim();
    if (normalized.length > MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH) {
      normalized = normalized.substring(0, MAXIMUM_SEMANTIC_LABEL_CHARACTER_LENGTH).trim();
    }
    return normalized;
  }
  function humanizeIdentifier(identifier) {
    return identifier.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").toLowerCase().replace(/\s+/g, " ").trim();
  }

  // applications/chrome_extension/content/elementScanner.ts
  var NATIVE_INTERACTIVE_ELEMENTS_SELECTOR = [
    "a[href]",
    "button",
    "input:not([type='hidden'])",
    "textarea",
    "select",
    "summary",
    "option",
    "label[for]"
  ].join(", ");
  var ARIA_INTERACTIVE_ROLES_SELECTOR = [
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="radio"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]'
  ].join(", ");
  var FOCUSABLE_TABINDEX_SELECTOR = "[tabindex]";
  var CONTENT_EDITABLE_SELECTOR = '[contenteditable="true"], [contenteditable=""]';
  function scanInteractiveElements() {
    const candidateElements = collectCandidateElements();
    const deduplicatedElements = deduplicateElements(candidateElements);
    const interactiveElements = [];
    let elementIndex = 0;
    for (const domElement of deduplicatedElements) {
      if (!checkIsElementVisibleAndInteractable(domElement)) {
        continue;
      }
      const interactionType = classifyElementInteractionType(domElement);
      const semanticLabel = extractSemanticLabel(domElement);
      const viewportBoundingRectangle = domElement.getBoundingClientRect();
      const hintAssignmentPriority = computeElementPriority(domElement, interactionType, semanticLabel);
      interactiveElements.push({
        uniqueIdentifier: `ec-${elementIndex++}`,
        domElement,
        interactionType,
        semanticLabel,
        generatedHint: "",
        isCurrentlyVisible: true,
        viewportBoundingRectangle,
        hintAssignmentPriority
      });
    }
    interactiveElements.sort(
      (elementA, elementB) => elementA.hintAssignmentPriority - elementB.hintAssignmentPriority
    );
    return interactiveElements;
  }
  function collectCandidateElements() {
    const candidates = [];
    const nativeElements = document.querySelectorAll(NATIVE_INTERACTIVE_ELEMENTS_SELECTOR);
    candidates.push(...Array.from(nativeElements));
    const ariaElements = document.querySelectorAll(ARIA_INTERACTIVE_ROLES_SELECTOR);
    candidates.push(...Array.from(ariaElements));
    const focusableElements = document.querySelectorAll(FOCUSABLE_TABINDEX_SELECTOR);
    for (const element of focusableElements) {
      const tabIndexValue = parseInt(element.getAttribute("tabindex") ?? "-1", 10);
      if (tabIndexValue >= 0) {
        candidates.push(element);
      }
    }
    const contentEditableElements = document.querySelectorAll(CONTENT_EDITABLE_SELECTOR);
    candidates.push(...Array.from(contentEditableElements));
    const onclickElements = document.querySelectorAll("[onclick]");
    candidates.push(...Array.from(onclickElements));
    collectCursorPointerElements(candidates);
    return candidates;
  }
  function collectCursorPointerElements(existingCandidates) {
    const existingCandidateSet = new Set(existingCandidates);
    const potentialContainers = document.querySelectorAll(
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
  function deduplicateElements(elements) {
    const uniqueElementSet = /* @__PURE__ */ new Set();
    const deduplicatedList = [];
    for (const element of elements) {
      if (!uniqueElementSet.has(element)) {
        uniqueElementSet.add(element);
        deduplicatedList.push(element);
      }
    }
    return deduplicatedList;
  }
  function classifyElementInteractionType(element) {
    const tagName = element.tagName.toLowerCase();
    const ariaRole = element.getAttribute("role")?.toLowerCase() ?? "";
    if (tagName === "a") return "link";
    if (tagName === "button" || ariaRole === "button") return "button";
    if (tagName === "select") return "select";
    if (tagName === "textarea") return "textarea";
    if (tagName === "input") {
      const inputType = element.type?.toLowerCase() ?? "text";
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
  function computeElementPriority(element, interactionType, semanticLabel) {
    let priority = 50;
    const typeWeights = {
      button: -20,
      link: -15,
      input: -18,
      textarea: -10,
      select: -10,
      checkbox: -8,
      radio: -8,
      toggle: -8,
      menu: -5,
      unknown: 0
    };
    priority += typeWeights[interactionType];
    if (semanticLabel.length > 0) {
      priority -= 10;
    }
    const rect = element.getBoundingClientRect();
    const viewportCenterY = window.innerHeight / 2;
    const distanceFromCenter = Math.abs(rect.top - viewportCenterY) / viewportCenterY;
    priority += Math.floor(distanceFromCenter * 10);
    return priority;
  }

  // applications/chrome_extension/content/hintGenerator.ts
  var SINGLE_KEY_MOVEMENT_COST = {
    /* Left-hand home row (most preferred) */
    a: 0,
    s: 0,
    d: 0,
    f: 0,
    /* Left-hand top row */
    q: 1,
    w: 1,
    e: 1,
    r: 1,
    /* Left-hand bottom row */
    z: 2,
    x: 2,
    c: 2,
    v: 2,
    /* Left-hand extended */
    g: 1,
    t: 2,
    b: 3,
    /* Right-hand home row */
    h: 3,
    j: 3,
    k: 4,
    l: 4,
    /* Right-hand top row */
    y: 4,
    u: 4,
    i: 5,
    o: 5,
    p: 6,
    /* Right-hand bottom row */
    n: 3,
    m: 4
  };
  var KEY_FINGER_ASSIGNMENT = {
    q: 0,
    a: 0,
    z: 0,
    w: 1,
    s: 1,
    x: 1,
    e: 2,
    d: 2,
    c: 2,
    r: 3,
    f: 3,
    v: 3,
    t: 3,
    g: 3,
    b: 3,
    y: 6,
    h: 6,
    n: 6,
    u: 7,
    j: 7,
    m: 7,
    i: 8,
    k: 8,
    o: 9,
    l: 9,
    p: 10
  };
  var SAME_FINGER_CONSECUTIVE_PENALTY = 4;
  var SAME_HAND_REWARD = -1;
  var LEFT_HAND_KEYS = new Set("qwertasdfgzxcvb".split(""));
  var MAXIMUM_HINT_LENGTH = 4;
  var PREFERRED_HINT_LENGTH = 2;
  var ALLOWED_HINT_CHARACTERS = new Set("abcdefghijklmnopqrstuvwxyz".split(""));
  function generateUniqueHints(interactiveElements) {
    if (interactiveElements.length === 0) {
      return;
    }
    const assignedHints = /* @__PURE__ */ new Set();
    const elementCandidates = [];
    for (const element of interactiveElements) {
      const candidates = generateCandidateHints(element.semanticLabel);
      const scoredCandidates = candidates.map((hintText) => ({
        hintText,
        totalScore: computeHintScore(hintText, element.semanticLabel)
      }));
      scoredCandidates.sort((candidateA, candidateB) => candidateA.totalScore - candidateB.totalScore);
      elementCandidates.push({ element, scoredCandidates });
    }
    for (const { element, scoredCandidates } of elementCandidates) {
      let assignedHint = null;
      for (const candidate of scoredCandidates) {
        if (!assignedHints.has(candidate.hintText)) {
          assignedHint = candidate.hintText;
          break;
        }
      }
      if (assignedHint === null) {
        assignedHint = generateFallbackHint(assignedHints, element.semanticLabel);
      }
      element.generatedHint = assignedHint;
      assignedHints.add(assignedHint);
    }
  }
  function generateCandidateHints(semanticLabel) {
    const candidates = [];
    const tokens = tokenizeSemanticLabel(semanticLabel);
    if (tokens.length === 0) {
      return generateErgonomicFallbackCandidates();
    }
    const firstToken = tokens[0];
    const firstLetter = firstToken[0];
    if (firstToken.length >= 2) {
      const secondLetter = firstToken[1];
      if (ALLOWED_HINT_CHARACTERS.has(secondLetter)) {
        candidates.push(firstLetter + secondLetter);
      }
    }
    if (tokens.length >= 2) {
      const initials = tokens.map((token) => token[0]).filter((character) => character && ALLOWED_HINT_CHARACTERS.has(character)).join("").substring(0, MAXIMUM_HINT_LENGTH);
      if (initials.length >= 2) {
        candidates.push(initials);
      }
      for (let wordIndex = 1; wordIndex < Math.min(tokens.length, 4); wordIndex++) {
        const secondWordLetter = tokens[wordIndex][0];
        if (secondWordLetter && ALLOWED_HINT_CHARACTERS.has(secondWordLetter)) {
          candidates.push(firstLetter + secondWordLetter);
        }
      }
    }
    const consonantsInFirstToken = extractConsonants(firstToken);
    for (const consonant of consonantsInFirstToken) {
      if (consonant !== firstLetter && ALLOWED_HINT_CHARACTERS.has(consonant)) {
        candidates.push(firstLetter + consonant);
      }
    }
    const vowelsInFirstToken = extractVowels(firstToken);
    for (const vowel of vowelsInFirstToken) {
      if (vowel !== firstLetter && ALLOWED_HINT_CHARACTERS.has(vowel)) {
        candidates.push(firstLetter + vowel);
      }
    }
    if (consonantsInFirstToken.length >= 2) {
      candidates.push(consonantsInFirstToken[0] + consonantsInFirstToken[1]);
    }
    const uniqueCandidates = [];
    const seenCandidates = /* @__PURE__ */ new Set();
    for (const candidate of candidates) {
      if (!seenCandidates.has(candidate)) {
        seenCandidates.add(candidate);
        uniqueCandidates.push(candidate);
      }
    }
    return uniqueCandidates;
  }
  function tokenizeSemanticLabel(semanticLabel) {
    if (!semanticLabel || semanticLabel.trim().length === 0) {
      return [];
    }
    return semanticLabel.toLowerCase().split(/[\s\-_]+/).filter((token) => token.length > 0).filter((token) => /^[a-z]/.test(token));
  }
  function extractConsonants(text) {
    return text.split("").filter(
      (character) => "bcdfghjklmnpqrstvwxyz".includes(character)
    );
  }
  function extractVowels(text) {
    return text.split("").filter(
      (character) => "aeiou".includes(character)
    );
  }
  function generateErgonomicFallbackCandidates() {
    const preferredKeys = "asdfgqwertzxcv".split("");
    const candidates = [];
    for (const firstKey of preferredKeys) {
      for (const secondKey of preferredKeys) {
        if (firstKey !== secondKey) {
          candidates.push(firstKey + secondKey);
        }
      }
    }
    return candidates;
  }
  function computeHintScore(hintText, semanticLabel) {
    let totalScore = 0;
    totalScore += computeErgonomicCost(hintText);
    totalScore += computeSemanticMatchScore(hintText, semanticLabel);
    totalScore += computeLengthPenalty(hintText);
    return totalScore;
  }
  function computeErgonomicCost(hintText) {
    let cost = 0;
    for (let characterIndex = 0; characterIndex < hintText.length; characterIndex++) {
      const character = hintText[characterIndex];
      cost += SINGLE_KEY_MOVEMENT_COST[character] ?? 5;
      if (characterIndex > 0) {
        const previousCharacter = hintText[characterIndex - 1];
        const currentFinger = KEY_FINGER_ASSIGNMENT[character] ?? -1;
        const previousFinger = KEY_FINGER_ASSIGNMENT[previousCharacter] ?? -2;
        if (currentFinger === previousFinger && currentFinger >= 0) {
          cost += SAME_FINGER_CONSECUTIVE_PENALTY;
        }
      }
    }
    if (hintText.length >= 2) {
      const allSameHand = hintText.split("").every((character) => LEFT_HAND_KEYS.has(character));
      if (allSameHand) {
        cost += SAME_HAND_REWARD * hintText.length;
      }
    }
    return cost;
  }
  function computeSemanticMatchScore(hintText, semanticLabel) {
    if (!semanticLabel || semanticLabel.length === 0) {
      return 0;
    }
    const tokens = tokenizeSemanticLabel(semanticLabel);
    if (tokens.length >= hintText.length) {
      const initialsMatch = hintText.split("").every(
        (character, index) => tokens[index] && tokens[index][0] === character
      );
      if (initialsMatch) {
        return -8;
      }
    }
    if (tokens[0] && tokens[0].startsWith(hintText)) {
      return -5;
    }
    if (tokens[0] && checkIsSubsequenceOf(hintText, tokens[0])) {
      return -3;
    }
    if (tokens[0] && hintText[0] === tokens[0][0]) {
      return -2;
    }
    return 3;
  }
  function checkIsSubsequenceOf(subsequence, superstring) {
    let subsequenceIndex = 0;
    for (let superstringIndex = 0; superstringIndex < superstring.length && subsequenceIndex < subsequence.length; superstringIndex++) {
      if (superstring[superstringIndex] === subsequence[subsequenceIndex]) {
        subsequenceIndex++;
      }
    }
    return subsequenceIndex === subsequence.length;
  }
  function computeLengthPenalty(hintText) {
    if (hintText.length <= 1) return 50;
    if (hintText.length === PREFERRED_HINT_LENGTH) return 0;
    return (hintText.length - PREFERRED_HINT_LENGTH) * 2;
  }
  function generateFallbackHint(assignedHints, semanticLabel) {
    const tokens = tokenizeSemanticLabel(semanticLabel);
    const baseCharacter = tokens.length > 0 && tokens[0][0] ? tokens[0][0] : "a";
    const extensionKeys = "asdfgqwertzxcvbhjklnm".split("");
    for (let hintLength = 2; hintLength <= MAXIMUM_HINT_LENGTH; hintLength++) {
      for (const extensionKey of extensionKeys) {
        const candidateHint = baseCharacter + extensionKey;
        if (candidateHint.length === hintLength && !assignedHints.has(candidateHint)) {
          return candidateHint;
        }
      }
      if (hintLength === 3) {
        for (const keyA of extensionKeys) {
          for (const keyB of extensionKeys) {
            const candidateHint = baseCharacter + keyA + keyB;
            if (!assignedHints.has(candidateHint)) {
              return candidateHint;
            }
          }
        }
      }
    }
    const fallbackKeys = "asdfgqwertzxcv".split("");
    for (const keyA of fallbackKeys) {
      for (const keyB of fallbackKeys) {
        for (const keyC of fallbackKeys) {
          const candidateHint = keyA + keyB + keyC;
          if (!assignedHints.has(candidateHint)) {
            return candidateHint;
          }
        }
      }
    }
    return `x${assignedHints.size}`;
  }

  // applications/chrome_extension/content/overlayManager.ts
  var OVERLAY_CSS_CLASS_PREFIX = "easyclick-overlay";
  var OVERLAY_CONTAINER_ELEMENT_ID = "easyclick-overlay-container";
  var OVERLAY_STYLE_ELEMENT_ID = "easyclick-overlay-styles";
  var OVERLAY_Z_INDEX = 2147483640;
  var OVERLAP_OFFSET_INCREMENT_PIXELS = 18;
  var activeOverlayElements = /* @__PURE__ */ new Map();
  var overlayContainerElement = null;
  function createOverlays(interactiveElements) {
    injectOverlayStyles();
    ensureOverlayContainerExists();
    const occupiedPositionRegions = [];
    for (const element of interactiveElements) {
      if (element.generatedHint.length === 0) {
        continue;
      }
      const overlayLabel = createSingleOverlayLabel(element, occupiedPositionRegions);
      activeOverlayElements.set(element.uniqueIdentifier, overlayLabel);
      overlayContainerElement.appendChild(overlayLabel);
    }
  }
  function removeAllOverlays() {
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
  function updateOverlaysForFilterInput(typedInput, interactiveElements) {
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
  function resetOverlaysToUnfilteredState(interactiveElements) {
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
  function ensureOverlayContainerExists() {
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
  function createSingleOverlayLabel(interactiveElement, occupiedRegions) {
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
    occupiedRegions.push({
      left,
      top,
      right: left + 30,
      bottom: top + 20
    });
    return label;
  }
  function computeNonOverlappingPosition(targetRectangle, occupiedRegions) {
    const candidatePositions = [
      { left: targetRectangle.left, top: targetRectangle.top - 16 },
      { left: targetRectangle.right - 24, top: targetRectangle.top - 16 },
      { left: targetRectangle.left, top: targetRectangle.bottom + 2 },
      { left: targetRectangle.right - 24, top: targetRectangle.bottom + 2 }
    ];
    for (const candidate of candidatePositions) {
      if (!checkPositionOverlapsOccupiedRegions(candidate, occupiedRegions)) {
        return clampPositionToViewport(candidate);
      }
    }
    let adjustedPosition = { left: targetRectangle.left, top: targetRectangle.top - 16 };
    let offsetAttempts = 0;
    while (checkPositionOverlapsOccupiedRegions(adjustedPosition, occupiedRegions) && offsetAttempts < 10) {
      adjustedPosition = {
        left: adjustedPosition.left,
        top: adjustedPosition.top - OVERLAP_OFFSET_INCREMENT_PIXELS
      };
      offsetAttempts++;
    }
    return clampPositionToViewport(adjustedPosition);
  }
  function checkPositionOverlapsOccupiedRegions(position, occupiedRegions) {
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
  function clampPositionToViewport(position) {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return {
      left: Math.max(2, Math.min(position.left, viewportWidth - 32)),
      top: Math.max(2, Math.min(position.top, viewportHeight - 20))
    };
  }
  function renderHighlightedHintText(overlayElement, fullHintText, matchedCharacterCount) {
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
  function injectOverlayStyles() {
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

  // applications/chrome_extension/content/actionExecutor.ts
  function executeElementAction(element, interactionType) {
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
  function executeClickAction(element) {
    scrollElementIntoViewIfNeeded(element);
    element.focus({ preventScroll: true });
    element.click();
  }
  function executeFocusAction(element) {
    scrollElementIntoViewIfNeeded(element);
    element.focus({ preventScroll: true });
    const inputElement = element;
    if (typeof inputElement.select === "function") {
      try {
        inputElement.select();
      } catch {
      }
    }
  }
  function executeToggleAction(element) {
    scrollElementIntoViewIfNeeded(element);
    const inputElement = element;
    if (inputElement.type === "checkbox") {
      inputElement.checked = !inputElement.checked;
      dispatchChangeEvent(inputElement);
      dispatchInputEvent(inputElement);
    } else {
      element.click();
    }
  }
  function executeSelectDropdownAction(element) {
    scrollElementIntoViewIfNeeded(element);
    element.focus({ preventScroll: true });
    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(mouseDownEvent);
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window
    });
    element.dispatchEvent(clickEvent);
  }
  function scrollElementIntoViewIfNeeded(element) {
    const rectangle = element.getBoundingClientRect();
    const isFullyVisible = rectangle.top >= 0 && rectangle.left >= 0 && rectangle.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rectangle.right <= (window.innerWidth || document.documentElement.clientWidth);
    if (!isFullyVisible) {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }
  function dispatchChangeEvent(element) {
    const changeEvent = new Event("change", { bubbles: true, cancelable: false });
    element.dispatchEvent(changeEvent);
  }
  function dispatchInputEvent(element) {
    const inputEvent = new Event("input", { bubbles: true, cancelable: false });
    element.dispatchEvent(inputEvent);
  }

  // applications/chrome_extension/content/keyboardEngine.ts
  var currentTypedInput = "";
  var isHintModeCurrentlyActive = false;
  var currentInteractiveElements = [];
  var onHintModeDeactivationCallback = null;
  var boundKeydownHandler = null;
  function activateKeyboardListening(interactiveElements, onDeactivation) {
    if (isHintModeCurrentlyActive) {
      return;
    }
    currentInteractiveElements = interactiveElements;
    onHintModeDeactivationCallback = onDeactivation;
    currentTypedInput = "";
    isHintModeCurrentlyActive = true;
    defocusActiveTextInputElement();
    boundKeydownHandler = handleHintModeKeydown;
    document.addEventListener("keydown", boundKeydownHandler, true);
  }
  function deactivateKeyboardListening() {
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
  function handleHintModeKeydown(event) {
    if (!isHintModeCurrentlyActive) {
      return;
    }
    if (event.key === "Control" || event.key === "Alt" || event.key === "Shift" || event.key === "Meta") {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      requestHintModeDeactivation();
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleBackspaceKeypress();
      return;
    }
    if (event.key.length === 1 && /^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleAlphabeticKeypress(event.key.toLowerCase());
      return;
    }
  }
  function handleAlphabeticKeypress(character) {
    currentTypedInput += character;
    updateOverlaysForFilterInput(currentTypedInput, currentInteractiveElements);
    const matchingElements = currentInteractiveElements.filter(
      (element) => element.generatedHint.toLowerCase().startsWith(currentTypedInput)
    );
    if (matchingElements.length === 0) {
      currentTypedInput = currentTypedInput.slice(0, -1);
      updateOverlaysForFilterInput(currentTypedInput, currentInteractiveElements);
      return;
    }
    const exactMatchElement = matchingElements.find(
      (element) => element.generatedHint.toLowerCase() === currentTypedInput
    );
    if (exactMatchElement) {
      setTimeout(() => {
        executeElementAction(exactMatchElement.domElement, exactMatchElement.interactionType);
        requestHintModeDeactivation();
      }, 80);
      return;
    }
  }
  function handleBackspaceKeypress() {
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
  function requestHintModeDeactivation() {
    if (onHintModeDeactivationCallback) {
      onHintModeDeactivationCallback();
    }
  }
  function defocusActiveTextInputElement() {
    const activeElement = document.activeElement;
    if (!activeElement) {
      return;
    }
    const tagName = activeElement.tagName.toLowerCase();
    const isTextInput = tagName === "input" || tagName === "textarea" || activeElement.getAttribute("contenteditable") === "true" || activeElement.getAttribute("contenteditable") === "";
    if (isTextInput) {
      activeElement.blur();
    }
  }

  // applications/chrome_extension/content/contentScript.ts
  var isHintModeActive = false;
  var currentInteractiveElements2 = [];
  var activeDomMutationObserver = null;
  var scrollResizeThrottleTimerId = null;
  var SCROLL_RESIZE_THROTTLE_INTERVAL_MILLISECONDS = 200;
  var isControlKeyCurrentlyHeld = false;
  var isAltKeyCurrentlyHeld = false;
  var wasNonModifierKeyPressedDuringModifierSequence = false;
  document.addEventListener("keydown", (event) => {
    if (event.key === "Control") {
      isControlKeyCurrentlyHeld = true;
      wasNonModifierKeyPressedDuringModifierSequence = false;
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
      if (isControlKeyCurrentlyHeld) {
        event.preventDefault();
        toggleHintMode();
        return;
      }
      return;
    }
    if (event.key !== "Shift" && event.key !== "Meta") {
      wasNonModifierKeyPressedDuringModifierSequence = true;
    }
    if (event.key === "." && event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleHintMode();
      return;
    }
    if (event.key === ";" && event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleHintMode();
      return;
    }
  }, true);
  document.addEventListener("keyup", (event) => {
    if (event.key === "Control") {
      isControlKeyCurrentlyHeld = false;
    }
    if (event.key === "Alt") {
      isAltKeyCurrentlyHeld = false;
    }
  }, true);
  function showContentScriptLoadedToast() {
    const toast = document.createElement("div");
    toast.textContent = "\u2328 EasyClick ready \u2014 Press Ctrl + . to activate";
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
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 350);
    }, 2500);
  }
  function toggleHintMode() {
    if (isHintModeActive) {
      deactivateHintMode();
    } else {
      activateHintMode();
    }
  }
  function activateHintMode() {
    if (isHintModeActive) {
      return;
    }
    isHintModeActive = true;
    currentInteractiveElements2 = scanInteractiveElements();
    if (currentInteractiveElements2.length === 0) {
      isHintModeActive = false;
      return;
    }
    generateUniqueHints(currentInteractiveElements2);
    createOverlays(currentInteractiveElements2);
    activateKeyboardListening(currentInteractiveElements2, deactivateHintMode);
    attachDynamicPageObservers();
    console.log(`[EasyClick] Hint mode activated. ${currentInteractiveElements2.length} elements scanned.`);
  }
  function deactivateHintMode() {
    if (!isHintModeActive) {
      return;
    }
    isHintModeActive = false;
    deactivateKeyboardListening();
    removeAllOverlays();
    detachDynamicPageObservers();
    currentInteractiveElements2 = [];
    console.log("[EasyClick] Hint mode deactivated.");
  }
  var OVERLAY_CONTAINER_ELEMENT_ID2 = "easyclick-overlay-container";
  var OVERLAY_STYLE_ELEMENT_ID2 = "easyclick-overlay-styles";
  function attachDynamicPageObservers() {
    activeDomMutationObserver = new MutationObserver((mutationRecords) => {
      if (!isHintModeActive) {
        return;
      }
      const overlayContainer = document.getElementById(OVERLAY_CONTAINER_ELEMENT_ID2);
      const hasPageMutationOutsideOverlay = mutationRecords.some((mutationRecord) => {
        const mutationTarget = mutationRecord.target;
        if (overlayContainer && (mutationTarget === overlayContainer || overlayContainer.contains(mutationTarget))) {
          return false;
        }
        if (mutationTarget instanceof HTMLElement && mutationTarget.id === OVERLAY_STYLE_ELEMENT_ID2) {
          return false;
        }
        return true;
      });
      if (!hasPageMutationOutsideOverlay) {
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
    });
    activeDomMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "disabled", "aria-disabled", "hidden"]
    });
    window.addEventListener("scroll", handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
  }
  function detachDynamicPageObservers() {
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
  function handleScrollOrResize() {
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
  function regenerateHintsAndOverlays() {
    removeAllOverlays();
    deactivateKeyboardListening();
    currentInteractiveElements2 = scanInteractiveElements();
    if (currentInteractiveElements2.length === 0) {
      deactivateHintMode();
      return;
    }
    generateUniqueHints(currentInteractiveElements2);
    createOverlays(currentInteractiveElements2);
    activateKeyboardListening(currentInteractiveElements2, deactivateHintMode);
  }
  console.log("[EasyClick] Content script loaded. Press Ctrl+. or Ctrl+; to activate hint mode.");
  showContentScriptLoadedToast();
})();
