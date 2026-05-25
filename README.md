# Empty Sketch — p5.js Starter Template

> A minimal p5.js starter template for the ZHdK *Coding Basic* module (FS26).
> Ein minimales p5.js-Starter-Template für das ZHdK-Modul *Coding Basic* (FS26).

---

## 🇬🇧 English

### Overview

This is an empty starter sketch for [p5.js](https://p5js.org/) — a JavaScript library for creative coding. It provides everything you need to begin sketching in code: the p5.js core library, the p5.sound add-on, a minimal HTML host page, and a pre-configured Visual Studio Code workspace.

Use this template as a fresh starting point whenever you begin a new sketch or exercise.

### Project Structure

```
Empty Sketch/
├── .vscode/
│   ├── extensions.json     # Recommended VS Code extensions
│   ├── global.d.ts         # p5.js type definitions for autocomplete
│   └── settings.json       # Live Server configuration
├── libraries/
│   ├── p5.min.js           # p5.js core library
│   └── p5.sound.min.js     # p5.sound add-on library
├── .gitignore
├── index.html              # HTML host page (loads libraries + sketch)
├── jsconfig.json           # JS IntelliSense configuration
├── sketch.js               # Your sketch — edit this file
└── style.css               # Page styling (removes margins, etc.)
```

### Requirements

- **[Visual Studio Code](https://code.visualstudio.com/)** — recommended editor
- The following VS Code extensions (you will be prompted to install them automatically):
  - [`samplavigne.p5-vscode`](https://marketplace.visualstudio.com/items?itemName=samplavigne.p5-vscode) — p5.js snippets and helpers
  - [`ritwickdey.liveserver`](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) — local development server with auto-reload
  - [`continue.continue`](https://marketplace.visualstudio.com/items?itemName=continue.continue) — AI coding assistant (optional)
- A modern web browser (Chrome is preconfigured for Live Server)

### Getting Started

1. **Open the folder** in Visual Studio Code.
2. **Install the recommended extensions** when prompted (or run `Extensions: Show Recommended Extensions` from the Command Palette).
3. **Start the Live Server**: click the **"Go Live"** button in the bottom-right of the status bar, or right-click `index.html` → *Open with Live Server*.
4. The sketch will open in your browser at `http://127.0.0.1:5500` and reload automatically whenever you save a file.

### The Sketch

The default `sketch.js` draws two diagonal lines forming an "X" across the canvas:

```js
function setup() {
  createCanvas(448, 256);
  fullscreen(true);
}

function draw() {
  background(220);
  line(0, 0, width, height);
  line(0, height, width, 0);
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}
```

- **`setup()`** runs once when the sketch starts. The canvas is created at 448×256 pixels and immediately switched to fullscreen mode.
- **`draw()`** runs continuously (≈60 times per second). It clears the canvas to light gray and draws the two diagonal lines.
- **`keyPressed()`** toggles fullscreen mode when the **F** key is pressed.

### Customising the Sketch

Replace the contents of `sketch.js` with your own code. A few common starting points:

- Change the canvas size in `createCanvas(width, height)`.
- Remove `fullscreen(true)` if you do not want the sketch to enter fullscreen on launch.
- Use `background()`, `fill()`, `stroke()`, `ellipse()`, `rect()`, `line()`, etc. to draw shapes.
- See the [p5.js reference](https://p5js.org/reference/) for the full API.

### Tips

- **Autocomplete**: p5.js type definitions are bundled in `.vscode/global.d.ts`, so functions like `createCanvas`, `ellipse`, `fill`, etc. will autocomplete and show parameter hints.
- **Console**: open your browser's developer tools (⌥⌘I on macOS) to view `console.log()` output and errors.
- **Sound**: `p5.sound.min.js` is already loaded — you can use sound features without adding extra `<script>` tags.

### License

This template is intended for educational use within the ZHdK *Basic* module.

---

## 🇩🇪 Deutsch

### Übersicht

Dies ist ein leeres Starter-Sketch für [p5.js](https://p5js.org/) — eine JavaScript-Bibliothek für kreatives Programmieren. Es enthält alles, was du brauchst, um mit Code zu skizzieren: die p5.js-Kernbibliothek, das p5.sound-Add-on, eine minimale HTML-Datei und eine vorkonfigurierte Visual-Studio-Code-Arbeitsumgebung.

Verwende dieses Template als sauberen Ausgangspunkt für jeden neuen Sketch oder jede neue Übung.

### Projektstruktur

```
Empty Sketch/
├── .vscode/
│   ├── extensions.json     # Empfohlene VS-Code-Erweiterungen
│   ├── global.d.ts         # p5.js-Typdefinitionen für Autovervollständigung
│   └── settings.json       # Live-Server-Konfiguration
├── libraries/
│   ├── p5.min.js           # p5.js-Kernbibliothek
│   └── p5.sound.min.js     # p5.sound-Add-on
├── .gitignore
├── index.html              # HTML-Hostseite (lädt Bibliotheken + Sketch)
├── jsconfig.json           # JS-IntelliSense-Konfiguration
├── sketch.js               # Dein Sketch — diese Datei bearbeiten
└── style.css               # Seitenstyling (Ränder entfernen usw.)
```

### Voraussetzungen

- **[Visual Studio Code](https://code.visualstudio.com/)** — empfohlener Editor
- Die folgenden VS-Code-Erweiterungen (du wirst automatisch zur Installation aufgefordert):
  - [`samplavigne.p5-vscode`](https://marketplace.visualstudio.com/items?itemName=samplavigne.p5-vscode) — p5.js-Snippets und Hilfen
  - [`ritwickdey.liveserver`](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) — lokaler Entwicklungs-Server mit automatischem Neuladen
  - [`continue.continue`](https://marketplace.visualstudio.com/items?itemName=continue.continue) — KI-Coding-Assistent (optional)
- Ein moderner Webbrowser (Chrome ist für Live Server vorkonfiguriert)

### Erste Schritte

1. **Ordner öffnen** in Visual Studio Code.
2. **Empfohlene Erweiterungen installieren**, wenn du dazu aufgefordert wirst (oder über die Befehlspalette: `Erweiterungen: Empfohlene Erweiterungen anzeigen`).
3. **Live Server starten**: Klicke auf die Schaltfläche **„Go Live"** unten rechts in der Statusleiste, oder Rechtsklick auf `index.html` → *Open with Live Server*.
4. Der Sketch öffnet sich im Browser unter `http://127.0.0.1:5500` und wird bei jeder Speicherung automatisch neu geladen.

### Der Sketch

Der mitgelieferte `sketch.js` zeichnet zwei diagonale Linien, die ein „X" über die Leinwand bilden:

```js
function setup() {
  createCanvas(448, 256);
  fullscreen(true);
}

function draw() {
  background(220);
  line(0, 0, width, height);
  line(0, height, width, 0);
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}
```

- **`setup()`** wird einmal beim Start des Sketches ausgeführt. Die Leinwand wird mit 448×256 Pixeln erstellt und sofort in den Vollbildmodus geschaltet.
- **`draw()`** läuft kontinuierlich (ca. 60 Mal pro Sekunde). Die Funktion leert die Leinwand mit hellgrauem Hintergrund und zeichnet die beiden Diagonalen.
- **`keyPressed()`** schaltet den Vollbildmodus um, wenn die Taste **F** gedrückt wird.

### Den Sketch anpassen

Ersetze den Inhalt von `sketch.js` durch deinen eigenen Code. Einige typische Anpassungen:

- Leinwandgrösse ändern mit `createCanvas(breite, höhe)`.
- `fullscreen(true)` entfernen, falls der Sketch nicht automatisch im Vollbild starten soll.
- `background()`, `fill()`, `stroke()`, `ellipse()`, `rect()`, `line()` usw. verwenden, um Formen zu zeichnen.
- Vollständige API-Dokumentation: [p5.js Reference](https://p5js.org/reference/).

### Tipps

- **Autovervollständigung**: Die p5.js-Typdefinitionen sind in `.vscode/global.d.ts` enthalten, sodass Funktionen wie `createCanvas`, `ellipse`, `fill` usw. automatisch vervollständigt werden und Parameter-Hinweise anzeigen.
- **Konsole**: Öffne die Entwicklerwerkzeuge deines Browsers (⌥⌘I auf macOS), um Ausgaben von `console.log()` sowie Fehlermeldungen zu sehen.
- **Sound**: `p5.sound.min.js` ist bereits geladen — Sound-Funktionen können ohne zusätzliche `<script>`-Tags verwendet werden.

### Lizenz

Dieses Template ist für den Unterricht im ZHdK-Modul *Basic* vorgesehen.

---

## Resources / Ressourcen

- [p5.js Website](https://p5js.org/)
- [p5.js Reference](https://p5js.org/reference/)
- [p5.js Examples](https://p5js.org/examples/)
- [The Coding Train (YouTube)](https://thecodingtrain.com/) — Tutorials by Daniel Shiffman
- [ZHdK](https://www.zhdk.ch/)
