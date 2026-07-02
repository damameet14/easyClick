/**
 * DOM Fingerprinting Engine
 * 
 * Provides robust identification of DOM elements across page loads and dynamic changes
 * by extracting structural contexts, stable classes, and hierarchy.
 */

export interface ElementFingerprint {
  tagName: string;
  contextLandmark: string;
  stableClasses: string[];
  path: string;
  rawLabel: string;
  interactionType: string;
}

/**
 * Generates a robust fingerprint for a given DOM element.
 */
export function generateFingerprint(
  element: HTMLElement,
  interactionType: string,
  rawLabel: string
): ElementFingerprint {
  return {
    tagName: element.tagName.toLowerCase(),
    contextLandmark: findContextLandmark(element),
    stableClasses: extractStableClasses(element),
    path: buildStructuralPath(element),
    rawLabel: rawLabel,
    interactionType: interactionType,
  };
}

/**
 * Scores how well a DOM element matches a saved fingerprint.
 * Higher score is better. Score of 0 means completely incompatible.
 */
export function scoreElementAgainstFingerprint(
  element: HTMLElement,
  interactionType: string,
  rawLabel: string,
  fingerprint: ElementFingerprint
): number {
  let score = 0;

  // Hard requirement: MUST have same interaction type
  if (interactionType !== fingerprint.interactionType) return 0;
  
  // Tag name match (+20)
  if (element.tagName.toLowerCase() === fingerprint.tagName) {
    score += 20;
  }

  // Landmark context match (+30)
  if (findContextLandmark(element) === fingerprint.contextLandmark) {
    score += 30;
  }

  // Stable classes overlap (+10 per matching class)
  const elementClasses = new Set(extractStableClasses(element));
  for (const cls of fingerprint.stableClasses) {
    if (elementClasses.has(cls)) {
      score += 10;
    }
  }

  // Raw Label match (+40) - Not strictly required because labels can change dynamically (e.g. "Search Leads" -> "Search Contacts")
  if (rawLabel === fingerprint.rawLabel) {
    score += 40;
  } else if (fingerprint.rawLabel && rawLabel.includes(fingerprint.rawLabel.split(' ')[0])) {
    // Partial match (e.g. "Search" in "Search Leads") (+15)
    score += 15;
  }

  // Path similarity (+20 for exact, +10 for partial)
  const currentPath = buildStructuralPath(element);
  if (currentPath === fingerprint.path) {
    score += 20;
  } else if (currentPath.endsWith(fingerprint.path.split(' > ').slice(-2).join(' > '))) {
    // Last two nodes match
    score += 10;
  }

  return score;
}

/**
 * Finds the closest semantic landmark containing the element.
 */
function findContextLandmark(element: HTMLElement): string {
  const landmarks = ['header', 'nav', 'main', 'footer', 'aside', 'form'];
  let current: HTMLElement | null = element;
  
  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    if (landmarks.includes(tag)) {
      return tag;
    }
    const role = current.getAttribute('role');
    if (role && ['banner', 'navigation', 'main', 'contentinfo', 'complementary', 'search'].includes(role)) {
      return role;
    }
    current = current.parentElement;
  }
  return 'document';
}

/**
 * Extracts classes that are unlikely to change due to hover/focus/active states.
 */
function extractStableClasses(element: HTMLElement): string[] {
  if (!element.className || typeof element.className !== 'string') return [];
  
  const classes = element.className.split(/\s+/).filter(Boolean);
  const dynamicPatterns = [
    /^is-/, /^has-/, /^hover:/, /^focus:/, /^active:/, /^!/, /--active$/, /--open$/, /--expanded$/
  ];
  
  return classes.filter(cls => {
    return !dynamicPatterns.some(pattern => pattern.test(cls));
  });
}

/**
 * Builds a simplified CSS selector path up to 3 levels deep.
 */
function buildStructuralPath(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;
  
  while (current && current !== document.body && depth < 3) {
    parts.unshift(current.tagName.toLowerCase());
    current = current.parentElement;
    depth++;
  }
  
  return parts.join(' > ');
}
