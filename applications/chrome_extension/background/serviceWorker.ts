/**
 * Background Service Worker for EasyClick Chrome Extension.
 *
 * Handles extension lifecycle events and message passing between
 * the popup/options pages and the content scripts.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[EasyClick] Extension installed successfully.");
  } else if (details.reason === "update") {
    console.log(`[EasyClick] Extension updated to version ${chrome.runtime.getManifest().version}.`);
  }
});

/**
 * Listen for messages from popup or options pages.
 * Currently a placeholder for future configuration sync.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_EXTENSION_STATUS") {
    sendResponse({ isActive: true, version: chrome.runtime.getManifest().version });
    return true;
  }
  return false;
});
