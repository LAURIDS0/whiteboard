# LC Whiteboard

En standalone whiteboard-hjemmeside uden backend.

## Struktur

- `index.html` — UI, værktøjer og dialoger.
- `css/` — opdelt styling for board, værktøjer, dialoger og responsive regler.
- `js/state.js` — fælles state og DOM-referencer.
- `js/ui.js` — paneler, kontrol-popover, dialoger, lagliste og feedback.
- `js/canvas.js` — blyant, pensel, markør, linjer, former og viskelæder på canvas.
- `js/objects.js` — noter, billeder, flytning, rotation, størrelsesændring og lag.
- `js/history.js` — undo/redo og automatisk lokal browser-gemning.
- `js/export.js` — PNG-eksport af både canvas og objekter.
- `js/app.js` — event wiring, værktøjslogik og tastaturgenveje.

## Kontrolmenuer

Hver kontrol viser kun den indstilling, der hører til den valgte funktion:

- `Farve` åbner kun farvevælger og pipette.
- `Tykkelse` åbner kun tykkelses-slider.
- `Gennemsigtighed` åbner kun gennemsigtigheds-slider.
- `Viskelæderstørrelse` åbner kun størrelses-slider.

Pen har farve, tykkelse og gennemsigtighed. Former og linjer har farve og tykkelse. Viskelæder har størrelse. Valgte objekter har gennemsigtighed. Der er ikke ekstra eller irrelevante kontroller i disse menuer.

## Billeder

Uploadede og indsatte billeder får automatisk en kontrolleret størrelse, der holder dem inden for whiteboardets arbejdsområde. Der er både bredde- og højderestriktioner, proportionerne bevares, resize er begrænset, og roterede billeder bliver også holdt inden for tavlens kanter.

## Tastatur

- `Ctrl/Cmd + Z` — Fortryd.
- `Ctrl/Cmd + Y` eller `Ctrl/Cmd + Shift + Z` — Gendan.
- `Ctrl/Cmd + S` — Gem PNG.
- `Delete` / `Backspace` — Slet valgt objekt.
- `Escape` — Luk aktiv dialog/popover eller afslut transformering.

## Afhængigheder

Projektet bruger Font Awesome via CDN til ikonerne. Resten af applikationen kræver ingen npm-installation eller backend.
