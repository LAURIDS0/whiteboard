(() => {
  const app = window.LCWhiteboard;
  const { dom, state } = app;

  const IMAGE_MAX_WIDTH_RATIO = 0.38;
  const IMAGE_MAX_HEIGHT_RATIO = 0.42;
  const IMAGE_MAX_WIDTH_PX = 520;
  const IMAGE_MAX_HEIGHT_PX = 360;

  function getImageLimits() {
    const width = Math.max(1, dom.objectLayer.clientWidth);
    const height = Math.max(1, dom.objectLayer.clientHeight);
    return {
      width: Math.min(width * IMAGE_MAX_WIDTH_RATIO, IMAGE_MAX_WIDTH_PX),
      height: Math.min(height * IMAGE_MAX_HEIGHT_RATIO, IMAGE_MAX_HEIGHT_PX)
    };
  }

  function fitImageToBoard(object, preserveRatio = true) {
    if (!object?.classList.contains('image')) return;
    const image = object.querySelector('img');
    const limits = getImageLimits();
    let width = object.offsetWidth || parseFloat(object.style.width) || limits.width;
    let height = object.offsetHeight || parseFloat(object.style.height) || limits.height;
    if (image?.naturalWidth && image.naturalHeight && preserveRatio) {
      const ratio = image.naturalWidth / image.naturalHeight;
      width = Math.min(width || limits.width, limits.width);
      height = width / ratio;
      if (height > limits.height) { height = limits.height; width = height * ratio; }
    } else {
      const scale = Math.min(1, limits.width / Math.max(width, 1), limits.height / Math.max(height, 1));
      width *= scale;
      height *= scale;
    }
    const minWidth = Math.min(96, limits.width);
    const minHeight = Math.min(64, limits.height);
    object.style.width = `${Math.max(minWidth, Math.min(width, limits.width))}px`;
    object.style.height = `${Math.max(minHeight, Math.min(height, limits.height))}px`;
  }

  function fitRotatedImageToBoard(object) {
    if (!object?.classList.contains('image')) return;
    const width = object.offsetWidth;
    const height = object.offsetHeight;
    const angle = (Number(object.dataset.rotation || 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const boundsW = width * cos + height * sin;
    const boundsH = width * sin + height * cos;
    const limits = getImageLimits();
    const availableW = Math.max(1, dom.objectLayer.clientWidth - 32);
    const availableH = Math.max(1, dom.objectLayer.clientHeight - 32);
    const scale = Math.min(1, limits.width / Math.max(boundsW, 1), limits.height / Math.max(boundsH, 1), availableW / Math.max(boundsW, 1), availableH / Math.max(boundsH, 1));
    if (scale < 0.999) {
      const minWidth = Math.min(96, limits.width);
      const minHeight = Math.min(64, limits.height);
      object.style.width = `${Math.max(minWidth, width * scale)}px`;
      object.style.height = `${Math.max(minHeight, height * scale)}px`;
    }
  }

  function setTransformMode(mode) {
    state.transformMode = mode;
    state.selectedObject?.classList.toggle('editing-resize', mode === 'resize');
    state.selectedObject?.classList.toggle('editing-rotate', mode === 'rotate');
  }

  function createObjectElement(type, data = {}) {
    const object = document.createElement('div');
    const placementIndex = state.objectCounter;
    const availableWidth = Math.max(1, dom.objectLayer.clientWidth);
    const columns = Math.max(1, Math.floor((availableWidth - 64) / 190));
    const defaultLeft = 32 + (placementIndex % columns) * 190;
    const defaultTop = 32 + Math.floor(placementIndex / columns) * 135;
    object.className = `board-object ${type}`;
    object.dataset.rotation = String(data.rotation ?? 0);
    object.dataset.opacity = String(data.opacity ?? 1);
    object.dataset.objectId = data.objectId || `object-${++state.objectCounter}`;
    object.dataset.label = data.label || '';
    object.style.left = data.left || `${defaultLeft}px`;
    object.style.top = data.top || `${defaultTop}px`;
    object.style.opacity = String(data.opacity ?? 1);
    if (data.width) object.style.width = data.width;
    if (data.height) object.style.height = data.height;

    if (object.classList.contains('image')) {
      object.dataset.source = data.source || '';
      const image = document.createElement('img');
      image.alt = data.alt || 'Indsat billede';
      image.src = data.source || '';
      image.addEventListener('error', () => {
        object.dataset.imageError = 'true';
        app.ui.showToast('Billedet kunne ikke indlæses.');
      });
      image.addEventListener('load', () => {
        if (!data.width || !data.height) fitImageToBoard(object, true);
        else { fitImageToBoard(object, false); fitRotatedImageToBoard(object); }
        clampObjectToBoard(object);
      }, { once: true });
      object.append(image);
    } else if (object.classList.contains('note')) {
      renderNote(object, data);
    } else {
      object.textContent = data.content || 'Objekt';
    }

    bindObject(object);
    return object;
  }

  function renderNote(object, data) {
    const title = document.createElement('div');
    const body = document.createElement('div');
    title.className = 'note-title';
    title.contentEditable = 'true';
    title.textContent = data.title || '';
    body.className = 'note-body';

    if (object.classList.contains('checklist')) {
      const items = Array.isArray(data.items) && data.items.length ? data.items : [
        { text: 'Før afgang', checked: false },
        { text: 'Tjek olie', checked: false },
        { text: 'Klar til marken', checked: false }
      ];
      const list = document.createElement('div');
      list.className = 'checklist-items';
      items.forEach((entry) => {
        const row = document.createElement('label');
        row.className = 'checklist-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(entry.checked);
        const text = document.createElement('span');
        text.contentEditable = 'true';
        text.textContent = entry.text || '';
        checkbox.addEventListener('change', () => app.history.saveHistory());
        text.addEventListener('blur', () => app.history.saveHistory());
        row.append(checkbox, text);
        list.append(row);
      });
      body.append(list);
    } else {
      body.contentEditable = 'true';
      body.textContent = data.body || '';
    }

    title.addEventListener('blur', () => app.history.saveHistory());
    body.addEventListener('blur', () => app.history.saveHistory());
    object.append(title, body);
  }

  function bindObject(object) {
    object.tabIndex = 0;

    object.addEventListener('click', (event) => {
      event.stopPropagation();
      if (state.activeTool === 'erase') {
        const canErase = state.eraseMode === 'objects' || (state.eraseMode === 'images' && object.classList.contains('image'));
        if (canErase) removeObject(object);
        return;
      }
      if (state.activeTool === 'select') selectObject(object);
    });

    object.addEventListener('dblclick', (event) => {
      if (state.activeTool === 'erase') return;
      const target = event.target.closest('.note-title, .note-body, .checklist-item span');
      if (target) {
        event.stopPropagation();
        target.focus();
      }
    });

    object.addEventListener('pointerdown', (event) => {
      if (event.target.closest('.transform-handle, [contenteditable], input')) return;
      if (state.activeTool === 'erase') return;
      if (state.activeTool !== 'select' || state.transformMode) return;
      event.preventDefault();
      event.stopPropagation();
      selectObject(object);
      state.dragState = {
        object,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: object.offsetLeft,
        top: object.offsetTop,
        moved: false
      };
      object.setPointerCapture(event.pointerId);
    });

    object.addEventListener('pointermove', (event) => {
      const drag = state.dragState;
      if (!drag || drag.object !== object || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 1) drag.moved = true;
      object.style.left = `${drag.left + dx}px`;
      object.style.top = `${drag.top + dy}px`;
    });

    const finishDrag = (event) => {
      const drag = state.dragState;
      if (!drag || drag.object !== object || (event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
      state.dragState = null;
      clampObjectToBoard(object);
      if (drag.moved) app.history.saveHistory();
      app.ui.renderLayerList?.();
    };

    object.addEventListener('pointerup', finishDrag);
    object.addEventListener('pointercancel', finishDrag);
  }

  function renderObjectControls(object) {
    object?.querySelector('.object-controls')?.remove();
    if (!object) return;

    const controls = document.createElement('div');
    const connector = document.createElement('span');
    const rotateHandle = document.createElement('button');
    const resizeHandle = document.createElement('button');
    controls.className = 'object-controls';
    connector.className = 'rotate-connector';
    rotateHandle.className = 'transform-handle rotate-handle';
    resizeHandle.className = 'transform-handle resize-handle';
    rotateHandle.type = 'button';
    resizeHandle.type = 'button';
    rotateHandle.setAttribute('aria-label', 'Roter objekt');
    resizeHandle.setAttribute('aria-label', 'Skaler objekt');

    rotateHandle.addEventListener('pointerdown', (event) => beginRotate(event, object));
    resizeHandle.addEventListener('pointerdown', (event) => beginResize(event, object));
    controls.append(connector, rotateHandle, resizeHandle);
    object.append(controls);
  }

  function selectObject(object) {
    if (state.selectedObject) {
      state.selectedObject.classList.remove('selected');
      state.selectedObject.querySelector('.object-controls')?.remove();
    }
    state.selectedObject = object;
    if (object) {
      object.classList.add('selected');
      renderObjectControls(object);
    }
    app.ui.renderLayerList?.();
    app.ui.updateSelectionControls?.();
  }

  function beginResize(event, object) {
    event.preventDefault();
    event.stopPropagation();
    state.transformMode = 'resize';
    setTransformMode('resize');
    const startWidth = object.offsetWidth;
    const startHeight = object.offsetHeight;
    const startX = event.clientX;
    const startY = event.clientY;
    const target = event.currentTarget;
    let moved = false;

    const resize = (moveEvent) => {
      let nextWidth = Math.max(64, startWidth + moveEvent.clientX - startX);
      let nextHeight = Math.max(48, startHeight + moveEvent.clientY - startY);
      if (object.classList.contains('image')) {
        const ratio = startWidth / Math.max(startHeight, 1);
        const limits = getImageLimits();
        nextWidth = Math.min(nextWidth, limits.width);
        nextHeight = nextWidth / ratio;
        if (nextHeight > limits.height) { nextHeight = limits.height; nextWidth = nextHeight * ratio; }
      }
      if (nextWidth !== object.offsetWidth || nextHeight !== object.offsetHeight) moved = true;
      object.style.width = `${nextWidth}px`;
      object.style.height = `${nextHeight}px`;
      fitRotatedImageToBoard(object);
      clampObjectToBoard(object);
    };
    const finish = () => {
      target.removeEventListener('pointermove', resize);
      target.removeEventListener('pointerup', finish);
      setTransformMode(null);
      clampObjectToBoard(object);
      if (moved) app.history.saveHistory();
    };
    target.addEventListener('pointermove', resize);
    target.addEventListener('pointerup', finish, { once: true });
    target.setPointerCapture(event.pointerId);
  }

  function beginRotate(event, object) {
    event.preventDefault();
    event.stopPropagation();
    setTransformMode('rotate');
    const bounds = object.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const baseRotation = Number(object.dataset.rotation || 0);
    const target = event.currentTarget;
    let moved = false;

    const rotate = (moveEvent) => {
      const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
      const nextRotation = baseRotation + ((angle - startAngle) * 180) / Math.PI;
      if (nextRotation !== baseRotation) moved = true;
      object.dataset.rotation = String(nextRotation);
      object.style.transform = `rotate(${nextRotation}deg)`;
      fitRotatedImageToBoard(object);
      clampObjectToBoard(object);
    };
    const finish = () => {
      target.removeEventListener('pointermove', rotate);
      target.removeEventListener('pointerup', finish);
      setTransformMode(null);
      if (moved) app.history.saveHistory();
    };
    target.addEventListener('pointermove', rotate);
    target.addEventListener('pointerup', finish, { once: true });
    target.setPointerCapture(event.pointerId);
  }

  function clampObjectToBoard(object) {
    if (!object || object.parentElement !== dom.objectLayer) return;
    const padding = 16;
    const maxLeft = Math.max(padding, dom.objectLayer.clientWidth - object.offsetWidth - padding);
    const maxTop = Math.max(padding, dom.objectLayer.clientHeight - object.offsetHeight - padding);
    object.style.left = `${Math.min(maxLeft, Math.max(padding, object.offsetLeft))}px`;
    object.style.top = `${Math.min(maxTop, Math.max(padding, object.offsetTop))}px`;
    const boardRect = dom.objectLayer.getBoundingClientRect();
    const rect = object.getBoundingClientRect();
    const minX = boardRect.left + padding;
    const maxX = boardRect.right - padding;
    const minY = boardRect.top + padding;
    const maxY = boardRect.bottom - padding;
    let shiftX = rect.left < minX ? minX - rect.left : rect.right > maxX ? maxX - rect.right : 0;
    let shiftY = rect.top < minY ? minY - rect.top : rect.bottom > maxY ? maxY - rect.bottom : 0;
    if (shiftX || shiftY) {
      object.style.left = `${object.offsetLeft + shiftX}px`;
      object.style.top = `${object.offsetTop + shiftY}px`;
    }
  }

  function clampAllToBoard() {
    [...dom.objectLayer.children].forEach((object) => {
      if (object.classList.contains('image')) { fitImageToBoard(object, true); fitRotatedImageToBoard(object); }
      clampObjectToBoard(object);
    });
  }

  function createObject(type, data = {}) {
    const object = createObjectElement(type, data);
    dom.objectLayer.append(object);
    clampObjectToBoard(object);
    selectObject(object);
    app.history.saveHistory();
    return object;
  }

  async function addNote(type) {
    const title = await app.ui.openInputDialog('Ny note', 'Overskrift', 'Skriv en overskrift...');
    if (!title) return;
    createObject(`note ${type}`, { title, label: title });
  }

  function addImageFromUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) {
        app.ui.showToast('Billedet må højst være 15 MB.');
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => createObject('image', { source: reader.result, label: file.name, alt: file.name }));
      reader.readAsDataURL(file);
    });
    input.click();
  }

  async function addImageFromUrl() {
    const url = await app.ui.openInputDialog('Indsæt billede', 'Billed-URL', 'https://...');
    if (!url) return;
    try { new URL(url); } catch { app.ui.showToast('Indtast en gyldig URL.'); return; }
    createObject('image', { source: url, label: 'Billede', alt: 'Indsat billede' });
  }

  function duplicateSelected() {
    if (!state.selectedObject) return;
    const source = serializeObject(state.selectedObject);
    source.objectId = undefined;
    source.left = `${state.selectedObject.offsetLeft + 24}px`;
    source.top = `${state.selectedObject.offsetTop + 24}px`;
    createObject(source.className.replace(/^board-object\s+/, ''), source);
  }

  function changeLayer(object = state.selectedObject, direction) {
    if (!object) return;
    const siblings = [...dom.objectLayer.children];
    const currentIndex = siblings.indexOf(object);
    if (currentIndex === -1) return;
    const nextIndex = direction === 'front' ? Math.min(siblings.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    if (nextIndex === currentIndex) return;
    if (direction === 'front') dom.objectLayer.insertBefore(object, siblings[nextIndex].nextSibling);
    else dom.objectLayer.insertBefore(object, siblings[nextIndex]);
    app.history.saveHistory();
    app.ui.renderLayerList?.();
  }

  function serializeObject(object) {
    const result = {
      className: object.className.replace(/\sselected\b/g, '').replace(/\sediting-(resize|rotate)\b/g, '').replace(/\shidden-by-filter\b/g, ''),
      left: object.style.left,
      top: object.style.top,
      width: object.style.width,
      height: object.style.height,
      rotation: object.dataset.rotation || '0',
      opacity: object.dataset.opacity || '1',
      objectId: object.dataset.objectId,
      label: object.dataset.label || ''
    };

    if (object.classList.contains('image')) {
      result.source = object.dataset.source || '';
      result.alt = object.querySelector('img')?.alt || 'Indsat billede';
    } else if (object.classList.contains('note')) {
      result.title = object.querySelector('.note-title')?.textContent || '';
      if (object.classList.contains('checklist')) {
        result.items = [...object.querySelectorAll('.checklist-item')].map((row) => ({
          text: row.querySelector('span')?.textContent || '',
          checked: Boolean(row.querySelector('input')?.checked)
        }));
      } else {
        result.body = object.querySelector('.note-body')?.textContent || '';
      }
    } else {
      result.content = object.textContent || '';
    }
    return result;
  }

  function serializeAll() { return [...dom.objectLayer.children].map(serializeObject); }

  function restoreAll(objects, selectId = null) {
    dom.objectLayer.replaceChildren();
    state.selectedObject = null;
    state.dragState = null;
    state.objectCounter = 0;
    (objects || []).forEach((data) => {
      const object = createObjectElement(data.className.replace(/^board-object\s+/, ''), data);
      dom.objectLayer.append(object);
      const numericId = Number(String(data.objectId || '').replace('object-', ''));
      if (Number.isFinite(numericId)) state.objectCounter = Math.max(state.objectCounter, numericId);
    });
    clampAllToBoard();
    app.ui.updateLayerFilter(state.layerFilter);
    if (selectId) {
      const restoredSelection = [...dom.objectLayer.children].find((object) => object.dataset.objectId === selectId && !object.classList.contains('hidden-by-filter'));
      if (restoredSelection) selectObject(restoredSelection);
    }
  }

  function removeObject(object) {
    if (!object) return;
    if (state.selectedObject === object) state.selectedObject = null;
    object.remove();
    app.history.saveHistory();
    app.ui.renderLayerList?.();
  }

  app.objects = {
    createObject,
    addNote,
    addImageFromUpload,
    addImageFromUrl,
    duplicateSelected,
    changeLayer,
    serializeAll,
    restoreAll,
    removeObject,
    selectObject,
    setTransformMode,
    clampObjectToBoard,
    clampAllToBoard
  };
})();
