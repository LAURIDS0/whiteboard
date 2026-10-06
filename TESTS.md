# Teststatus

Denne iteration er testet med fokus på UI-logik, kontrolmenuer, eksisterende whiteboardfunktioner, billedbegrænsninger og mobil layout.

## UI- og kontroltest

29 målrettede checks blev kørt to gange med 0 fejl. Der blev blandt andet verificeret:

- Pen: farve, tykkelse og gennemsigtighed åbner kun deres korrekte kontrol.
- Linje: farve og tykkelse åbner kun deres korrekte kontrol.
- Former indeholder ikke en irrelevant gennemsigtighedskontrol.
- Viskelæder indeholder kun sin størrelsesindstilling.
- Væg-handlinger, der kræver et objekt, er deaktiverede uden en markering.
- Kontrollerne bliver aktive igen, når et objekt er valgt.
- `window.confirm()` er ikke længere brugt til Ryd.
- De gamle redundante undo/redo/clear-optionpaneler er fjernet.

## Fuldt funktionsforløb

48 funktionelle Chromium-checks blev kørt to gange med 0 fejl. Testen gennemgår blandt andet:

- Blyant, pensel og markør.
- Undo/redo.
- Alle linjetyper.
- Alle former.
- Pen-indstillinger.
- Alle fire notetyper.
- Redigering af noter og checklist-status.
- Duplikering.
- Lagorden samt frem/tilbage.
- Flytning, rotation og resize.
- Objekt-gennemsigtighed.
- Billede via URL.
- Billede- og objekt-viskelæder.
- Linje-viskelæder.
- Ryd med annullering og bekræftelse.
- PNG-eksport.
- Mobil størrelse og fravær af horisontal overflow.
- Ingen runtime JavaScript-fejl eller browser console errors under testen.

## Billedbegrænsning

En stor testgrafik blev indsat og verificeret mod både bredde- og højdelimit samt tavlens kanter. Resize-begrænsningen og den visuelle clamping blev også dækket af regressionstesten.
