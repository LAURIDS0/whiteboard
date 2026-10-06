(() => {
  const app = window.LCWhiteboard;
  const { dom, state } = app;

  function showToast(message, duration = 2200) {
    dom.toast.textContent = message;
    dom.toast.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => dom.toast.classList.remove('visible'), duration);
  }

  function closeControlPopover() {
    const shouldCommit = state.controlChanged && state.controlRecordHistory;
    dom.controlPopover.hidden = true;
    state.controlUpdate = null;
    state.controlChanged = false;
    state.controlRecordHistory = false;
    if (shouldCommit) app.history.saveHistory();
  }

  function openRangeControl(title, min, max, step, value, suffix, update, recordHistory = false) {
    closeColorPopover();
    closeLayerPopover();
    dom.controlTitle.textContent = title;
    dom.controlRange.min = String(min);
    dom.controlRange.max = String(max);
    dom.controlRange.step = String(step);
    dom.controlRange.value = String(value);
    dom.controlRangeRow.hidden = false;
    dom.controlValue.textContent = `${value}${suffix}`;
    state.controlChanged = false;
    state.controlRecordHistory = recordHistory;
    state.controlUpdate = (nextValue) => {
      dom.controlValue.textContent = `${nextValue}${suffix}`;
      state.controlChanged = true;
      update(Number(nextValue));
    };
    dom.controlPopover.hidden = false;
  }

  function normalizeHex(value) {
    if (!value) return '#111827';
    if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
    const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) return '#111827';
    return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
  }

  function updateColorIndicator(value = state.color) {
    const color = normalizeHex(value);
    dom.colorInput.value = color;
    dom.colorPreviewSwatch.style.backgroundColor = color;
    dom.colorValue.textContent = color.toUpperCase();
    dom.colorToolSwatch.style.backgroundColor = color;
    dom.colorToolSwatch.style.boxShadow = `inset 0 0 0 1px color-mix(in srgb, ${color} 55%, #172033 45%)`;
    dom.colorToolSwatch.setAttribute('aria-label', `Valgt farve ${color}`);
  }

  function closeColorPopover() {
    dom.colorPopover.hidden = true;
    document.getElementById('color')?.classList.remove('active');
  }

  function openColorPopover() {
    closeControlPopover();
    closeLayerPopover();
    updateColorIndicator(state.color);
    dom.colorPopover.hidden = false;
    document.getElementById('color')?.classList.add('active');
  }

  function toggleColorPopover() {
    if (dom.colorPopover.hidden) openColorPopover();
    else closeColorPopover();
  }

  function setColor(value) {
    const color = normalizeHex(value);
    state.color = color;
    updateColorIndicator(color);
  }

  function openInputDialog(title, label, placeholder, submitLabel = 'Tilføj') {
    dom.dialogTitle.textContent = title;
    dom.dialogLabel.textContent = label;
    dom.dialogInput.placeholder = placeholder;
    dom.dialogInput.value = '';
    dom.inputDialog.querySelector('.dialog-button.primary').textContent = submitLabel;
    closeTransientPopovers();
    dom.dialogBackdrop.hidden = false;
    requestAnimationFrame(() => dom.dialogInput.focus());
    return new Promise((resolve) => { state.dialogResolver = resolve; });
  }

  function closeInputDialog(value = null) {
    dom.dialogBackdrop.hidden = true;
    dom.inputDialog.querySelector('.dialog-button.primary').textContent = 'Tilføj';
    if (!state.dialogResolver) return;
    const resolver = state.dialogResolver;
    state.dialogResolver = null;
    resolver(value);
  }

  function openConfirmDialog(title, message, confirmLabel = 'Bekræft') {
    dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    dom.confirmSubmit.textContent = confirmLabel;
    closeTransientPopovers();
    dom.confirmBackdrop.hidden = false;
    requestAnimationFrame(() => dom.confirmSubmit.focus());
    return new Promise((resolve) => { state.confirmResolver = resolve; });
  }

  function closeConfirmDialog(value = false) {
    dom.confirmBackdrop.hidden = true;
    if (!state.confirmResolver) return;
    const resolver = state.confirmResolver;
    state.confirmResolver = null;
    resolver(value);
  }

  function closeTransientPopovers() {
    closeControlPopover();
    closeColorPopover();
    closeLayerPopover();
  }

  function selectTool(toolId) {
    closeTransientPopovers();

    dom.toolButtons.forEach((button) => button.classList.toggle('active', button.id === toolId));
    if (!['undo', 'redo', 'save', 'clear'].includes(toolId)) state.activePanel = toolId;

    dom.optionPanels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === state.activePanel));
    if (toolId === 'layers') syncLayerFilterButtons();

    if (toolId === 'pen') state.activeTool = state.drawMode === 'pipette' ? 'pipette' : 'draw';
    else if (toolId === 'erase') state.activeTool = 'erase';
    else if (toolId === 'line') state.activeTool = 'line';
    else state.activeTool = 'select';

    app.canvas?.updateCursor?.();
    updateSelectionControls();
  }

  function setPanel(panelName) {
    state.activePanel = panelName;
    dom.optionPanels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === panelName));
  }

  function setOptionActive(option, active = true) {
    const panel = option?.closest('.options');
    if (!panel || option?.dataset.control || option?.dataset.action) return;
    const buttons = option.hasAttribute('data-layer-filter')
      ? [...document.querySelectorAll('[data-layer-filter]')]
      : [...panel.querySelectorAll('.option:not([data-layer-filter])')];
    buttons.forEach((button) => button.classList.toggle('active', active && button === option));
  }

  function updateSelectionControls() {
    const hasSelection = Boolean(state.selectedObject);
    dom.optionButtons.filter((button) => button.hasAttribute('data-requires-selection')).forEach((button) => {
      button.disabled = !hasSelection;
    });
  }

  function setCanvasCursor(cursor) { dom.canvas.style.cursor = cursor; }

  function syncLayerFilterButtons() {
    document.querySelectorAll('[data-layer-filter]').forEach((button) => {
      button.classList.toggle('active', button.dataset.layerFilter === state.layerFilter);
    });
  }

  function updateLayerFilter(filter) {
    state.layerFilter = filter;
    [...dom.objectLayer.children].forEach((object) => {
      const matches = filter === 'all' || (filter === 'notes' && object.classList.contains('note')) || (filter === 'images' && object.classList.contains('image'));
      object.classList.toggle('hidden-by-filter', !matches);
    });
    syncLayerFilterButtons();
  }

  function closeLayerPopover() { dom.layerPopover.hidden = true; }

  function renderLayerList() {
    const objects = [...dom.objectLayer.children];
    dom.layerList.replaceChildren();

    if (!objects.length) {
      const empty = document.createElement('div');
      empty.className = 'layer-empty';
      empty.textContent = 'Ingen lag endnu.';
      dom.layerList.append(empty);
      return;
    }

    objects.reverse().forEach((object) => {
      const item = document.createElement('div');
      item.className = `layer-item${object === state.selectedObject ? ' selected' : ''}`;

      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'layer-name';
      name.textContent = object.dataset.label || (object.classList.contains('note') ? app.notes.getLabel(object) : object.classList.contains('image') ? 'Billede' : 'Objekt');
      name.addEventListener('click', () => {
        app.objects.selectObject(object);
        closeLayerPopover();
      });

      const up = document.createElement('button');
      up.type = 'button';
      up.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
      up.setAttribute('aria-label', 'Flyt frem');
      up.addEventListener('click', () => app.objects.changeLayer(object, 'front'));

      const down = document.createElement('button');
      down.type = 'button';
      down.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
      down.setAttribute('aria-label', 'Flyt tilbage');
      down.addEventListener('click', () => app.objects.changeLayer(object, 'back'));

      item.append(name, up, down);
      dom.layerList.append(item);
    });
  }

  function openLayerPopover() {
    closeControlPopover();
    closeColorPopover();
    renderLayerList();
    dom.layerPopover.hidden = false;
  }

  function updateHistoryButtons() {
    const undo = document.getElementById('undo');
    const redo = document.getElementById('redo');
    if (undo) undo.disabled = state.historyIndex <= 0;
    if (redo) redo.disabled = state.historyIndex >= state.history.length - 1;
  }

  dom.inputDialog.addEventListener('submit', (event) => { event.preventDefault(); closeInputDialog(dom.dialogInput.value.trim() || null); });
  dom.dialogCancel.addEventListener('click', () => closeInputDialog());
  dom.dialogClose.addEventListener('click', () => closeInputDialog());
  dom.confirmCancel.addEventListener('click', () => closeConfirmDialog(false));
  dom.confirmClose.addEventListener('click', () => closeConfirmDialog(false));
  dom.confirmSubmit.addEventListener('click', () => closeConfirmDialog(true));
  dom.confirmBackdrop.addEventListener('click', (event) => { if (event.target === dom.confirmBackdrop) closeConfirmDialog(false); });
  dom.dialogBackdrop.addEventListener('click', (event) => { if (event.target === dom.dialogBackdrop) closeInputDialog(); });
  dom.controlRange.addEventListener('input', () => state.controlUpdate?.(dom.controlRange.value));
  dom.controlClose.addEventListener('click', closeControlPopover);
  dom.colorInput.addEventListener('input', () => setColor(dom.colorInput.value));
  dom.colorPreview.addEventListener('click', () => dom.colorInput.click());
  dom.colorClose.addEventListener('click', closeColorPopover);
  dom.colorPipette.addEventListener('click', () => {
    state.drawMode = 'pipette';
    state.activeTool = 'pipette';
    closeColorPopover();
    setCanvasCursor('crosshair');
    showToast('Klik på tavlen for at vælge en farve.');
  });
  dom.layerClose.addEventListener('click', closeLayerPopover);

  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const insideOpenPopover = target.closest('#control-popover, #color-popover, #layer-popover');
    const isPopoverTrigger = target.closest('#color, [data-control], [data-action="layer-order"], #layers');
    if (!insideOpenPopover && !isPopoverTrigger) closeTransientPopovers();
  });

  app.ui = {
    showToast,
    closeControlPopover,
    openRangeControl,
    normalizeHex,
    updateColorIndicator,
    setColor,
    openColorPopover,
    closeColorPopover,
    toggleColorPopover,
    openInputDialog,
    closeInputDialog,
    openConfirmDialog,
    closeConfirmDialog,
    selectTool,
    setPanel,
    setOptionActive,
    setCanvasCursor,
    updateLayerFilter,
    syncLayerFilterButtons,
    openLayerPopover,
    closeLayerPopover,
    renderLayerList,
    updateHistoryButtons,
    updateSelectionControls
  };

  updateColorIndicator(state.color);
})();
