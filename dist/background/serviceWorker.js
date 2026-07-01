"use strict";
(() => {
  // applications/chrome_extension/background/serviceWorker.ts
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      console.log("[EasyClick] Extension installed successfully.");
    } else if (details.reason === "update") {
      console.log(`[EasyClick] Extension updated to version ${chrome.runtime.getManifest().version}.`);
    }
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_EXTENSION_STATUS") {
      sendResponse({ isActive: true, version: chrome.runtime.getManifest().version });
      return true;
    }
    return false;
  });
})();
