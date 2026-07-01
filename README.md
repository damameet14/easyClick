# EasyClick — Semantic Keyboard Navigator

A Chrome extension that enables you to navigate and interact with **any website without touching the mouse**.

Unlike existing extensions (Vimium, SurfingKeys) that assign arbitrary key combinations, EasyClick assigns **human-readable, semantic, ergonomic shortcuts** to only the **currently visible interactive elements**.

The experience feels closer to pressing **Alt in Microsoft Excel** than using Vimium.

## Quick Start

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

This compiles all TypeScript source files and copies static assets to the `dist/` directory.

### Load in Chrome

1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** (toggle in the top-right).
3. Click **Load unpacked**.
4. Select the `dist/` folder.
5. The extension is now active on all pages.

### Activate Hint Mode

Press **Ctrl + Alt** or **Ctrl + ;** on any webpage:

1. Interactive elements on the page receive floating hint labels.
2. Type the hint letters to narrow down to a single element.
3. The action (click, focus, toggle) executes automatically.
4. Press **Escape** to exit hint mode.
5. Press **Backspace** to undo the last typed character.

## Architecture

```text
easyClick/
├── applications/
│   └── chrome_extension/
│       ├── manifest.json
│       ├── background/
│       │   └── serviceWorker.ts
│       ├── content/
│       │   ├── contentScript.ts        (Entry point & lifecycle orchestration)
│       │   ├── elementScanner.ts       (Finds interactive elements)
│       │   ├── visibilityEngine.ts     (Viewport & style visibility checks)
│       │   ├── semanticExtractor.ts    (Extracts labels from elements)
│       │   ├── hintGenerator.ts        (Assigns semantic, ergonomic hints)
│       │   ├── overlayManager.ts       (Renders floating hint badges)
│       │   ├── keyboardEngine.ts       (Handles typing & filtering)
│       │   └── actionExecutor.ts       (Clicks, focuses, toggles elements)
│       ├── popup/
│       │   ├── popup.html / popup.css / popup.ts
│       └── options/
│           ├── options.html / options.css / options.ts
├── build.js                            (esbuild bundler)
├── tsconfig.json
└── package.json
```

## How Hints Work

1. **Scan**: Find all visible interactive elements on the page.
2. **Extract**: Pull semantic labels from text content, aria-label, title, placeholder, etc.
3. **Generate**: Create candidate hints from word initials and letter combinations.
4. **Score**: Rank candidates by semantic relevance + keyboard ergonomics.
5. **Assign**: Greedily assign the best unique hint to each element.
6. **Display**: Render glassmorphism-styled overlay badges at each element.

### Ergonomic Keyboard Model

Left-hand home row keys (`A`, `S`, `D`, `F`, `G`) are preferred for one-handed operation. Right-hand and far keys have higher movement costs. Same-finger consecutive presses are penalized.

### Example

| Element         | Semantic Label | Hint |
|-----------------|---------------|------|
| Save button     | "save"        | `S`  |
| Save Draft      | "save draft"  | `SD` |
| Search input    | "search"      | `SR` |
| Delete button   | "delete"      | `DL` |
| Cancel link     | "cancel"      | `CA` |

## Development

### Watch Mode

```bash
npm run watch
```

Rebuilds automatically when source files change.

### Clean

```bash
npm run clean
```

Removes the `dist/` directory.

## Browser Support

- **Chrome** (Manifest V3) — fully supported
- Edge, Brave, Opera — expected to work (Chromium-based)
- Firefox — future version with adapter

## License

MIT
