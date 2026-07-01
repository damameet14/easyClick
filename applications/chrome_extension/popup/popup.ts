/**
 * Popup Script
 *
 * Handles the extension popup UI interactions. Queries the background
 * service worker for extension status and displays it.
 */

document.addEventListener("DOMContentLoaded", () => {
  initializePopupDisplay();
  attachSettingsLinkHandler();
});

/**
 * Queries the extension status and updates the popup display.
 */
async function initializePopupDisplay(): Promise<void> {
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

/**
 * Attaches the click handler for the settings link to open the options page.
 */
function attachSettingsLinkHandler(): void {
  const settingsLink = document.getElementById("popup-settings-link");
  if (settingsLink) {
    settingsLink.addEventListener("click", (event) => {
      event.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
}
