const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const isWatchMode = process.argv.includes("--watch");

const extensionSourceDirectory = path.join(__dirname, "applications", "chrome_extension");
const distributionOutputDirectory = path.join(__dirname, "dist");

/** Files and directories to copy verbatim into dist/ */
const staticFilesToCopy = [
  { source: path.join(extensionSourceDirectory, "manifest.json"), destination: path.join(distributionOutputDirectory, "manifest.json") },
  { source: path.join(extensionSourceDirectory, "popup", "popup.html"), destination: path.join(distributionOutputDirectory, "popup", "popup.html") },
  { source: path.join(extensionSourceDirectory, "popup", "popup.css"), destination: path.join(distributionOutputDirectory, "popup", "popup.css") },
  { source: path.join(extensionSourceDirectory, "options", "options.html"), destination: path.join(distributionOutputDirectory, "options", "options.html") },
  { source: path.join(extensionSourceDirectory, "options", "options.css"), destination: path.join(distributionOutputDirectory, "options", "options.css") },
  { source: path.join(extensionSourceDirectory, "assets", "icons", "icon-16.png"), destination: path.join(distributionOutputDirectory, "assets", "icons", "icon-16.png") },
  { source: path.join(extensionSourceDirectory, "assets", "icons", "icon-32.png"), destination: path.join(distributionOutputDirectory, "assets", "icons", "icon-32.png") },
  { source: path.join(extensionSourceDirectory, "assets", "icons", "icon-48.png"), destination: path.join(distributionOutputDirectory, "assets", "icons", "icon-48.png") },
  { source: path.join(extensionSourceDirectory, "assets", "icons", "icon-128.png"), destination: path.join(distributionOutputDirectory, "assets", "icons", "icon-128.png") },
];

function copyStaticFiles() {
  for (const { source, destination } of staticFilesToCopy) {
    if (!fs.existsSync(source)) {
      continue;
    }
    const destinationDirectory = path.dirname(destination);
    fs.mkdirSync(destinationDirectory, { recursive: true });
    fs.copyFileSync(source, destination);
  }
  console.log("[build] Static files copied.");
}

/** TypeScript entry points to bundle */
const entryPointBundles = [
  {
    entryPoint: path.join(extensionSourceDirectory, "background", "serviceWorker.ts"),
    outputFile: path.join(distributionOutputDirectory, "background", "serviceWorker.js"),
  },
  {
    entryPoint: path.join(extensionSourceDirectory, "content", "contentScript.ts"),
    outputFile: path.join(distributionOutputDirectory, "content", "contentScript.js"),
  },
  {
    entryPoint: path.join(extensionSourceDirectory, "popup", "popup.ts"),
    outputFile: path.join(distributionOutputDirectory, "popup", "popup.js"),
  },
  {
    entryPoint: path.join(extensionSourceDirectory, "options", "options.ts"),
    outputFile: path.join(distributionOutputDirectory, "options", "options.js"),
  },
];

async function buildAll() {
  copyStaticFiles();

  for (const bundle of entryPointBundles) {
    const buildOptions = {
      entryPoints: [bundle.entryPoint],
      outfile: bundle.outputFile,
      bundle: true,
      format: "iife",
      target: "chrome120",
      minify: false,
      sourcemap: false,
      logLevel: "info",
    };

    if (isWatchMode) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log(`[build] Watching ${path.basename(bundle.entryPoint)}...`);
    } else {
      await esbuild.build(buildOptions);
    }
  }

  if (!isWatchMode) {
    console.log("[build] Build complete.");
  }
}

buildAll().catch((error) => {
  console.error("[build] Build failed:", error);
  process.exit(1);
});
