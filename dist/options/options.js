"use strict";
(() => {
  // applications/chrome_extension/options/options.ts
  document.addEventListener("DOMContentLoaded", () => {
    displayExtensionVersion();
  });
  function displayExtensionVersion() {
    const versionTextElement = document.getElementById("options-version-text");
    if (versionTextElement) {
      const manifest = chrome.runtime.getManifest();
      versionTextElement.textContent = `Version ${manifest.version}`;
    }
  }
})();
