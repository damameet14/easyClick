/**
 * Memory Manager
 *
 * Persists and retrieves successfully executed keyboard hints.
 * Provides a "memory layer" so that preferred hints for specific
 * semantic labels are retained on a per-domain basis, with provisions
 * for global overrides.
 *
 * Saves data to both chrome.storage.local and chrome.storage.sync
 * as requested by user.
 */

import { ElementFingerprint, generateFingerprint } from "./fingerprintEngine";

export type DomainMemory = Record<string, ElementFingerprint>;

let currentDomainMemory: DomainMemory = {};
let currentGlobalMemory: Record<string, ElementFingerprint> = {};

/**
 * Initializes the memory layer by loading stored preferences
 * from chrome.storage for the current domain.
 * Should be called once on content script load.
 */
export function initializeMemoryManager(): void {
  const domainKey = `memory_domain_${window.location.hostname}`;
  const globalKey = 'memory_global';

  // Load from both sync and local, preferring sync if present
  try {
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get([domainKey, globalKey], (syncResult) => {
        if (chrome.runtime.lastError) {
          console.warn("[EasyClick] Sync storage error:", chrome.runtime.lastError);
          loadFromLocal(domainKey, globalKey);
          return;
        }
        
        // If sync has no data, fallback to local
        if (!syncResult[domainKey] && !syncResult[globalKey]) {
          loadFromLocal(domainKey, globalKey);
        } else {
          currentDomainMemory = syncResult[domainKey] || {};
          currentGlobalMemory = syncResult[globalKey] || {};
        }
      });
    } else {
      loadFromLocal(domainKey, globalKey);
    }
  } catch (error) {
    console.warn("[EasyClick] Error initializing memory manager:", error);
  }
}

function loadFromLocal(domainKey: string, globalKey: string): void {
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([domainKey, globalKey], (localResult) => {
      currentDomainMemory = localResult[domainKey] || {};
      currentGlobalMemory = localResult[globalKey] || {};
    });
  }
}

/**
 * Returns the currently loaded domain memory mapping hints to element fingerprints.
 */
export function getDomainMemory(): DomainMemory {
  return currentDomainMemory;
}

/**
 * Returns the currently loaded global memory mapping hints to element fingerprints.
 */
export function getGlobalMemory(): Record<string, ElementFingerprint> {
  return currentGlobalMemory;
}

/**
 * Remembers a successfully executed or explicitly saved hint for a given DOM element
 * on the current domain.
 */
export function rememberHint(element: HTMLElement, interactionType: string, rawSemanticLabel: string, hint: string): void {
  if (!element || !hint) return;
  
  const fingerprint = generateFingerprint(element, interactionType, rawSemanticLabel);
  
  // Update in-memory state: map hint -> fingerprint
  currentDomainMemory[hint] = fingerprint;

  const domainKey = `memory_domain_${window.location.hostname}`;

  const payload = {
    [domainKey]: currentDomainMemory
  };

  // Write to both local and sync storages
  try {
    if (chrome.storage) {
      if (chrome.storage.local) {
        chrome.storage.local.set(payload).catch(err => {
          console.warn("[EasyClick] Failed to save memory to local storage:", err);
        });
      }
      if (chrome.storage.sync) {
        chrome.storage.sync.set(payload).catch(err => {
          console.warn("[EasyClick] Failed to save memory to sync storage:", err);
        });
      }
    }
  } catch (error) {
    console.warn("[EasyClick] Extension context invalidated or storage error:", error);
  }
}
