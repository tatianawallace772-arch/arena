# BlockCraft Studio — Scratch App Maker & Google Blockly IDE

A full-featured Scratch-inspired visual **App & Game Maker** built with **React 19**, **TypeScript**, and **Google Blockly v13.5** (`zelos` Scratch 3.0 renderer + `@blockly/continuous-toolbox`).

![Google Blockly](https://img.shields.io/badge/Google_Blockly-v13.5-4C97FF) ![React](https://img.shields.io/badge/React-19-61DAFB) ![Vite](https://img.shields.io/badge/Vite-6-7C3AED)

## Highlights

| Module | Capabilities |
| --- | --- |
| **Google Blockly (`zelos` Scratch Engine)** | Continuous scrolling category flyout, rounded dome Event hat blocks, angle dials, color pickers, and 70+ Scratch & App Maker blocks across **Motion**, **Looks**, **Sound**, **Events**, **Control & Clones**, **Sensing**, **Operators**, **Variables**, **Pen**, **App UI**, and **Juice FX**. |
| **Gingerbread Star Mascot & Sprite Library** | Preloaded with the custom **Gingerbread Star** sprite featuring 3 transparent costumes (*Peace Pose*, *Star Wand*, *Happy Cheer*), plus a multi-category Sprite & SVG Backdrop Library. |
| **App UI Maker** | Design interactive mobile & web apps directly on the stage using draggable **Buttons**, **Titles/Badges**, **Text Inputs**, **Sliders**, and **Progress Bars**, plus switch between **4:3 Classic Stage**, **9:15 Smartphone Bezel**, and **16:9 Widescreen**. |
| **Costume Paint & Magic Wand Studio** | Built-in 512×512 HTML5 canvas editor with Brush, Eraser, Shapes, Flood Fill, **Magic Background Remover**, Flip H/V, Undo, and custom image upload. |
| **Web Audio Synth & Voice Studio** | Zero-dependency procedural sound synthesizer (11 presets + custom waveform/frequency lab), pitch/speed shifting, and Web Speech Text-to-Speech (`speak`). |
| **Live JS / Python Code Generator** | Real-time translation of visual Blockly stacks into readable `async/await` JavaScript, Python, and Blockly AST JSON. |
| **One-Click HTML5 & GitHub Repo Export** | Compile any project (with all sprites & costumes base64-inlined) into a single offline `.html` web app or a complete GitHub Pages starter repository `.zip`. |

## Quick Start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # TypeScript check + production bundle in dist/
```

## Installed Blockly Packages

- `blockly` (`^13.5.0`)
- `@blockly/continuous-toolbox` (`^13.5.0`)
- `@blockly/field-angle` (`^13.5.0`)
- `@blockly/field-colour` (`^13.5.0`)
- `@blockly/field-slider` (`^13.5.0`)
