"use strict";
(() => {
  // applications/chrome_extension/popup/popup.ts
  document.addEventListener("DOMContentLoaded", () => {
    initializePopupDisplay();
    attachSettingsLinkHandler();
  });
  async function initializePopupDisplay() {
    const versionTextElement = document.getElementById("popup-version-text");
    const statusTextElement = document.getElementById("popup-status-text");
    const statusIndicatorElement = document.getElementById("popup-status-indicator");
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_EXTENSION_STATUS" });
      if (response && response.version && versionTextElement) {
        versionTextElement.textContent = `v${response.version}`;
      }
      if (response && response.isActive) {
        if (statusTextElement) statusTextElement.textContent = "Active";
        if (statusIndicatorElement) {
          statusIndicatorElement.classList.add("popup-status__indicator--active");
          statusIndicatorElement.classList.remove("popup-status__indicator--inactive");
        }
      } else {
        if (statusTextElement) statusTextElement.textContent = "Inactive";
        if (statusIndicatorElement) {
          statusIndicatorElement.classList.add("popup-status__indicator--inactive");
          statusIndicatorElement.classList.remove("popup-status__indicator--active");
        }
      }
    } catch {
      if (statusTextElement) statusTextElement.textContent = "Active";
    }
  }
  function attachSettingsLinkHandler() {
    const settingsLink = document.getElementById("popup-settings-link");
    if (settingsLink) {
      settingsLink.addEventListener("click", (event) => {
        event.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }
})();
