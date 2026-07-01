/**
 * Hint Generator
 *
 * Produces unique, human-readable, ergonomic keyboard hints for each
 * interactive element. Hints are derived from the element's semantic label
 * and scored based on semantic relevance, keyboard ergonomics, and brevity.
 *
 * The algorithm:
 * 1. Tokenize each element's semantic label into words.
 * 2. Generate candidate hint strings (abbreviations, initials, subsequences).
 * 3. Score each candidate on ergonomics, semantic match, and length.
 * 4. Greedily assign the best-scoring unique hint to each element.
 * 5. Resolve collisions by extending hints or falling back to ergonomic codes.
 */

import { InteractiveElement } from "./elementScanner";

/* ──────────────────────────────────────────────────────────────────────────
   Keyboard Ergonomics Model
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Movement cost for each key. Lower cost = more ergonomic.
 * Left-hand home row and nearby keys are preferred for one-handed operation.
 */
const SINGLE_KEY_MOVEMENT_COST: Record<string, number> = {
  /* Left-hand home row (most preferred) */
  a: 0, s: 0, d: 0, f: 0,
  /* Left-hand top row */
  q: 1, w: 1, e: 1, r: 1,
  /* Left-hand bottom row */
  z: 2, x: 2, c: 2, v: 2,
  /* Left-hand extended */
  g: 1, t: 2, b: 3,
  /* Right-hand home row */
  h: 3, j: 3, k: 4, l: 4,
  /* Right-hand top row */
  y: 4, u: 4, i: 5, o: 5, p: 6,
  /* Right-hand bottom row */
  n: 3, m: 4,
};

/**
 * Finger assignment for each key (0 = pinky, 3 = index, etc.)
 * Used to detect same-finger penalties.
 */
const KEY_FINGER_ASSIGNMENT: Record<string, number> = {
  q: 0, a: 0, z: 0,
  w: 1, s: 1, x: 1,
  e: 2, d: 2, c: 2,
  r: 3, f: 3, v: 3, t: 3, g: 3, b: 3,
  y: 6, h: 6, n: 6,
  u: 7, j: 7, m: 7,
  i: 8, k: 8,
  o: 9, l: 9,
  p: 10,
};

/** Penalty added when consecutive keys use the same finger. */
const SAME_FINGER_CONSECUTIVE_PENALTY = 4;

/** Reward for keys on the same hand (facilitates one-handed use). */
const SAME_HAND_REWARD = -1;

/** Keys considered left-hand keys. */
const LEFT_HAND_KEYS = new Set("qwertasdfgzxcvb".split(""));

/* ──────────────────────────────────────────────────────────────────────────
   Hint Candidate Generation
   ──────────────────────────────────────────────────────────────────────── */

/** Maximum hint length in characters. */
const MAXIMUM_HINT_LENGTH = 4;

/** Preferred hint length for scoring. */
const PREFERRED_HINT_LENGTH = 2;

/** Characters allowed in hints. */
const ALLOWED_HINT_CHARACTERS = new Set("abcdefghijklmnopqrstuvwxyz".split(""));

/**
 * Generates unique ergonomic hints for all provided interactive elements.
 * Mutates each element's `generatedHint` property in-place.
 *
 * @param interactiveElements - Elements to assign hints to (sorted by priority).
 */
export function generateUniqueHints(interactiveElements: InteractiveElement[], domainMemory: Record<string, string> = {}): void {
  if (interactiveElements.length === 0) {
    return;
  }

  const assignedHints = new Set<string>();

  /* Memory pre-pass: Assign hints from memory if available and not yet taken */
  for (const element of interactiveElements) {
    const normalizedLabel = element.semanticLabel?.trim().toLowerCase();
    if (normalizedLabel && domainMemory[normalizedLabel]) {
      const memoryHint = domainMemory[normalizedLabel];
      if (!assignedHints.has(memoryHint)) {
        element.generatedHint = memoryHint;
        assignedHints.add(memoryHint);
      }
    }
  }

  /* First pass: generate scored candidates for each element */
  const elementCandidates: Array<{
    element: InteractiveElement;
    scoredCandidates: Array<{ hintText: string; totalScore: number }>;
  }> = [];

  for (const element of interactiveElements) {
    if (element.generatedHint) {
      continue; // Skip elements already assigned by memory layer
    }

    const candidates = generateCandidateHints(element.semanticLabel);
    const scoredCandidates = candidates.map((hintText) => ({
      hintText,
      totalScore: computeHintScore(hintText, element.semanticLabel),
    }));

    /* Sort by score ascending (lower = better) */
    scoredCandidates.sort((candidateA, candidateB) => candidateA.totalScore - candidateB.totalScore);

    elementCandidates.push({ element, scoredCandidates });
  }

  /* Second pass: greedy assignment with collision resolution */
  for (const { element, scoredCandidates } of elementCandidates) {
    let assignedHint: string | null = null;

    for (const candidate of scoredCandidates) {
      if (!assignedHints.has(candidate.hintText)) {
        assignedHint = candidate.hintText;
        break;
      }
    }

    /* If all candidates are taken, extend or generate a fallback */
    if (assignedHint === null) {
      assignedHint = generateFallbackHint(assignedHints, element.semanticLabel);
    }

    element.generatedHint = assignedHint;
    assignedHints.add(assignedHint);
  }
}

/**
 * Generates a list of candidate hint strings from a semantic label.
 *
 * All hints are at least 2 characters to allow progressive narrowing.
 *
 * Strategies:
 * 1. First letter of each word (initials): "Save Draft" → "sd"
 * 2. First letter + consonants of first word: "Search" → "sr", "sc", "sh"
 * 3. First letter + subsequent vowels/consonants: "Delete" → "dl", "de", "dt"
 * 4. Two-letter combinations from first two words
 */
function generateCandidateHints(semanticLabel: string): string[] {
  const candidates: string[] = [];
  const tokens = tokenizeSemanticLabel(semanticLabel);

  if (tokens.length === 0) {
    /* No semantic content - generate pure ergonomic candidates */
    return generateErgonomicFallbackCandidates();
  }

  const firstToken = tokens[0];
  const firstLetter = firstToken[0];

  /* Strategy 2: First letter + second letter of first word */
  if (firstToken.length >= 2) {
    const secondLetter = firstToken[1];
    if (ALLOWED_HINT_CHARACTERS.has(secondLetter)) {
      candidates.push(firstLetter + secondLetter);
    }
  }

  /* Strategy 3: Initials from multiple words */
  if (tokens.length >= 2) {
    const initials = tokens
      .map((token) => token[0])
      .filter((character) => character && ALLOWED_HINT_CHARACTERS.has(character))
      .join("")
      .substring(0, MAXIMUM_HINT_LENGTH);

    if (initials.length >= 2) {
      candidates.push(initials);
    }

    /* Two-word combinations: first letter of word1 + first letter of word2 */
    for (let wordIndex = 1; wordIndex < Math.min(tokens.length, 4); wordIndex++) {
      const secondWordLetter = tokens[wordIndex][0];
      if (secondWordLetter && ALLOWED_HINT_CHARACTERS.has(secondWordLetter)) {
        candidates.push(firstLetter + secondWordLetter);
      }
    }
  }

  /* Strategy 4: First letter + consonants from the first token */
  const consonantsInFirstToken = extractConsonants(firstToken);
  for (const consonant of consonantsInFirstToken) {
    if (consonant !== firstLetter && ALLOWED_HINT_CHARACTERS.has(consonant)) {
      candidates.push(firstLetter + consonant);
    }
  }

  /* Strategy 5: First letter + vowels from the first token */
  const vowelsInFirstToken = extractVowels(firstToken);
  for (const vowel of vowelsInFirstToken) {
    if (vowel !== firstLetter && ALLOWED_HINT_CHARACTERS.has(vowel)) {
      candidates.push(firstLetter + vowel);
    }
  }

  /* Strategy 6: First two consonants of the first word */
  if (consonantsInFirstToken.length >= 2) {
    candidates.push(consonantsInFirstToken[0] + consonantsInFirstToken[1]);
  }

  /* Deduplicate candidates */
  const uniqueCandidates: string[] = [];
  const seenCandidates = new Set<string>();
  for (const candidate of candidates) {
    if (!seenCandidates.has(candidate)) {
      seenCandidates.add(candidate);
      uniqueCandidates.push(candidate);
    }
  }

  return uniqueCandidates;
}

/**
 * Tokenizes a semantic label into individual word tokens.
 * Filters out empty and single-character noise tokens.
 */
function tokenizeSemanticLabel(semanticLabel: string): string[] {
  if (!semanticLabel || semanticLabel.trim().length === 0) {
    return [];
  }

  return semanticLabel
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter((token) => token.length > 0)
    .filter((token) => /^[a-z]/.test(token));
}

/**
 * Extracts consonant characters from a string.
 */
function extractConsonants(text: string): string[] {
  return text.split("").filter((character) =>
    "bcdfghjklmnpqrstvwxyz".includes(character)
  );
}

/**
 * Extracts vowel characters from a string.
 */
function extractVowels(text: string): string[] {
  return text.split("").filter((character) =>
    "aeiou".includes(character)
  );
}

/**
 * Generates ergonomic fallback candidates when no semantic label is available.
 * Uses preferred left-hand key combinations.
 */
function generateErgonomicFallbackCandidates(): string[] {
  const preferredKeys = "asdfgqwertzxcv".split("");
  const candidates: string[] = [];

  for (const firstKey of preferredKeys) {
    for (const secondKey of preferredKeys) {
      if (firstKey !== secondKey) {
        candidates.push(firstKey + secondKey);
      }
    }
  }

  return candidates;
}

/* ──────────────────────────────────────────────────────────────────────────
   Hint Scoring
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Computes a composite score for a hint candidate. Lower score = better hint.
 *
 * Components:
 * - Ergonomic cost: movement cost, same-finger penalties, hand preference
 * - Semantic match: bonus if hint letters appear in the semantic label
 * - Length penalty: slight penalty for longer hints
 */
function computeHintScore(hintText: string, semanticLabel: string): number {
  let totalScore = 0;

  /* Ergonomic cost */
  totalScore += computeErgonomicCost(hintText);

  /* Semantic match bonus */
  totalScore += computeSemanticMatchScore(hintText, semanticLabel);

  /* Length penalty */
  totalScore += computeLengthPenalty(hintText);

  return totalScore;
}

/**
 * Computes the ergonomic keyboard cost of typing a hint.
 */
function computeErgonomicCost(hintText: string): number {
  let cost = 0;

  for (let characterIndex = 0; characterIndex < hintText.length; characterIndex++) {
    const character = hintText[characterIndex];
    cost += SINGLE_KEY_MOVEMENT_COST[character] ?? 5;

    /* Same-finger consecutive penalty */
    if (characterIndex > 0) {
      const previousCharacter = hintText[characterIndex - 1];
      const currentFinger = KEY_FINGER_ASSIGNMENT[character] ?? -1;
      const previousFinger = KEY_FINGER_ASSIGNMENT[previousCharacter] ?? -2;

      if (currentFinger === previousFinger && currentFinger >= 0) {
        cost += SAME_FINGER_CONSECUTIVE_PENALTY;
      }
    }
  }

  /* Same-hand reward for one-handed operation */
  if (hintText.length >= 2) {
    const allSameHand = hintText.split("").every((character) => LEFT_HAND_KEYS.has(character));
    if (allSameHand) {
      cost += SAME_HAND_REWARD * hintText.length;
    }
  }

  return cost;
}

/**
 * Computes a semantic match score. Rewards hints that are recognizable
 * abbreviations of the semantic label.
 */
function computeSemanticMatchScore(hintText: string, semanticLabel: string): number {
  if (!semanticLabel || semanticLabel.length === 0) {
    return 0;
  }

  const tokens = tokenizeSemanticLabel(semanticLabel);

  /* Check if hint matches initials of first N words */
  if (tokens.length >= hintText.length) {
    const initialsMatch = hintText.split("").every((character, index) =>
      tokens[index] && tokens[index][0] === character
    );
    if (initialsMatch) {
      return -8; /* Strong reward for initial match */
    }
  }

  /* Check if hint is a prefix of the first word */
  if (tokens[0] && tokens[0].startsWith(hintText)) {
    return -5;
  }

  /* Check if hint letters appear in order in the first word */
  if (tokens[0] && checkIsSubsequenceOf(hintText, tokens[0])) {
    return -3;
  }

  /* Check if first letter matches first token */
  if (tokens[0] && hintText[0] === tokens[0][0]) {
    return -2;
  }

  /* No semantic relationship */
  return 3;
}

/**
 * Checks if `subsequence` is a subsequence of `superstring`.
 */
function checkIsSubsequenceOf(subsequence: string, superstring: string): boolean {
  let subsequenceIndex = 0;
  for (let superstringIndex = 0; superstringIndex < superstring.length && subsequenceIndex < subsequence.length; superstringIndex++) {
    if (superstring[superstringIndex] === subsequence[subsequenceIndex]) {
      subsequenceIndex++;
    }
  }
  return subsequenceIndex === subsequence.length;
}

/**
 * Computes a length penalty. Two-letter hints are optimal.
 * Single-letter hints are heavily penalized to enforce minimum length of 2.
 */
function computeLengthPenalty(hintText: string): number {
  if (hintText.length <= 1) return 50; /* Heavily penalize single-letter hints */
  if (hintText.length === PREFERRED_HINT_LENGTH) return 0;
  return (hintText.length - PREFERRED_HINT_LENGTH) * 2;
}

/* ──────────────────────────────────────────────────────────────────────────
   Collision Resolution & Fallback
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Generates a unique fallback hint when all semantic candidates are taken.
 * Extends existing candidates with additional characters, or generates
 * purely ergonomic codes.
 */
function generateFallbackHint(assignedHints: Set<string>, semanticLabel: string): string {
  const tokens = tokenizeSemanticLabel(semanticLabel);
  const baseCharacter = tokens.length > 0 && tokens[0][0] ? tokens[0][0] : "a";

  /* Try extending with preferred keys */
  const extensionKeys = "asdfgqwertzxcvbhjklnm".split("");

  for (let hintLength = 2; hintLength <= MAXIMUM_HINT_LENGTH; hintLength++) {
    for (const extensionKey of extensionKeys) {
      const candidateHint = baseCharacter + extensionKey;
      if (candidateHint.length === hintLength && !assignedHints.has(candidateHint)) {
        return candidateHint;
      }
    }

    /* Try three-character hints */
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

  /* Ultimate fallback: sequential ergonomic codes */
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

  /* Should never reach here with reasonable page sizes */
  return `x${assignedHints.size}`;
}
