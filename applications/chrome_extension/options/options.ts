/**
 * Options Page Script
 *
 * Initializes the options page with the current extension version.
 * Future versions will add user-configurable settings here.
 */

document.addEventListener("DOMContentLoaded", () => {
  displayExtensionVersion();
});

/**
 * Fetches and displays the current extension version.
 */
function displayExtensionVersion(): void {
  const versionTextElement = document.getElementById("options-version-text");
  if (versionTextElement) {
    const manifest = chrome.runtime.getManifest();
    versionTextElement.textContent = `Version ${manifest.version}`;
  }
}
