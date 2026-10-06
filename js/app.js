(() => {
  const app = window.LCWhiteboard;
  const { dom, state } = app;

  function isTypingTarget(target) {
    return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  }

  function openRange(title, min, max, step, value, suffix, update, recordHistory = false) {
    app.ui.openRangeControl(title, min, max, step, value, suffix, (next) => {
      update(next);
      app.canvas.redraw(false);
    }, recordHistory);
  }

  function handleOption(option) {
    const action = option.dataset.option;
    const control = option.dataset.control;
    const panel = option.closest('.options')?.dataset.panel;

    if (control === 'pen-thickness' || control === 'shape-thickness' || control === 'line-thickness') {
      openRange('Tykkelse', 1, 24, 1, state.lineWidth, ' px', (value) => { state.lineWidth = value; });
      return;
    }

    if (control === 'eraser-size') {
      openRange('Viskelæderstørrelse', 4, 64, 2, state.eraserSize, ' px', (value) => { state.eraserSize = value; });
      return;
    }

    if (control === 'pen-opacity') {
      openRange('Gennemsigtighed', 10, 100, 5, Math.round(state.opacity * 100), '%', (value) => { state.opacity = value / 100; });
      return;
    }

    if (control === 'object-opacity') {
      const value = Number(state.selectedObject?.dataset.opacity || 1);
      openRange('Gennemsigtighed', 10, 100, 5, Math.round(value * 100), '%', (next) => {
        if (!state.selectedObject) return;
        state.selectedObject.dataset.opacity = String(next / 100);
        state.selectedObject.style.opacity = String(next / 100);
      }, true);
      return;
    }

    if (control === 'pen-color' || control === 'line-color' || control === 'shape-color') {
      app.ui.openColorControl('Farve', state.color, (value) => { state.color = value; });
      return;
    }

    if (option.dataset.action === 'shapes') {
      app.ui.setPanel('shapes');
      state.activeTool = 'shape';
      app.canvas.updateCursor();
      return;
    }

    if (option.dataset.action === 'layer-order') {
      app.ui.openLayerPopover();
      return;
    }

    if (option.dataset.layerFilter) {
      app.ui.setOptionActive(option, true);
      app.ui.updateLayerFilter(option.dataset.layerFilter);
      return;
    }

    app.ui.setOptionActive(option, true);

    if (panel === 'wall') {
      if (action === 'select') { state.activeTool = 'select'; app.objects.setTransformMode(null); }
      if (action === 'rotate') app.objects.setTransformMode('rotate');
      if (action === 'resize') app.objects.setTransformMode('resize');
      if (action === 'duplicate') app.objects.duplicateSelected();
    }

    if (panel === 'pen' && ['pencil', 'brush', 'marker'].includes(action)) {
      state.drawMode = action;
      state.activeTool = 'draw';
      app.canvas.updateCursor();
    }

    if (panel === 'shapes' && ['rectangle', 'circle', 'triangle', 'star'].includes(action)) {
      state.shapeType = action;
      state.activeTool = 'shape';
      app.canvas.updateCursor();
    }

    if (panel === 'erase' && ['objects', 'lines', 'images'].includes(action)) {
      state.eraseMode = action;
      state.activeTool = 'erase';
      app.objects.selectObject(null);
      app.canvas.updateCursor();
    }

    if (panel === 'notes' && ['sticky', 'paper', 'checklist', 'text'].includes(action)) app.objects.addNote(action);

    if (panel === 'images') {
      if (action === 'upload') app.objects.addImageFromUpload();
      if (action === 'url') app.objects.addImageFromUrl();
    }

    if (panel === 'line' && ['straight', 'parallel', 'arrow', 'dotted'].includes(action)) {
      state.lineStyle = action;
      state.activeTool = 'line';
      app.canvas.updateCursor();
    }

    if (panel === 'layers') {
      if (action === 'front') app.objects.changeLayer(state.selectedObject, 'front');
      if (action === 'back') app.objects.changeLayer(state.selectedObject, 'back');
    }
  }

  async function clearWhiteboard() {
    const hasContent = state.drawings.length || dom.objectLayer.children.length;
    if (!hasContent) return;
    const confirmed = await app.ui.openConfirmDialog('Ryd whiteboard', 'Alle noter, billeder og tegninger bliver fjernet.', 'Ryd whiteboard');
    if (!confirmed) return;
    state.drawings = [];
    state.drawingCounter = 0;
    app.canvas.redraw(false);
    app.objects.restoreAll([]);
    app.objects.selectObject(null);
    app.history.saveHistory({ force: true });
    app.ui.selectTool('wall');
    app.history.clearSavedState();
  }

  function handleTool(button) {
    const id = button.id;
    if (id === 'undo') return app.history.undo();
    if (id === 'redo') return app.history.redo();
    if (id === 'save') return app.exporter.exportWhiteboard();
    if (id === 'clear') return clearWhiteboard();
    app.ui.selectTool(id);
  }

  function handleKeyboard(event) {
    if (event.key === 'Escape') {
      if (!dom.dialogBackdrop.hidden) app.ui.closeInputDialog();
      else if (!dom.confirmBackdrop.hidden) app.ui.closeConfirmDialog();
      else if (!dom.controlPopover.hidden) app.ui.closeControlPopover();
      else if (!dom.layerPopover.hidden) app.ui.closeLayerPopover();
      else if (state.transformMode) app.objects.setTransformMode(null);
      return;
    }

    if (isTypingTarget(event.target)) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); app.history.undo(); return; }
    if ((event.metaKey || event.ctrlKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) { event.preventDefault(); app.history.redo(); return; }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); app.exporter.exportWhiteboard(); return; }

    if ((event.key === 'Backspace' || event.key === 'Delete') && state.selectedObject && state.activeTool === 'select') {
      event.preventDefault();
      app.objects.removeObject(state.selectedObject);
    }
  }

  dom.toolButtons.forEach((button) => button.addEventListener('click', () => handleTool(button)));
  dom.optionButtons.forEach((option) => option.addEventListener('click', () => handleOption(option)));
  document.addEventListener('keydown', handleKeyboard);

  function initialize() {
    app.canvas.resizeCanvas();
    const restored = app.history.loadSavedState();
    if (!restored) app.history.saveHistory({ force: true });
    app.ui.selectTool('wall');
    app.ui.updateHistoryButtons();
    app.ui.updateSelectionControls();
    state.loaded = true;
    app.canvas.updateCursor();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
