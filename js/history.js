(() => {
  const app = window.LCWhiteboard;
  const { state } = app;
  const STORAGE_KEY = 'lc_whiteboard_state_v2';
  const MAX_HISTORY = 80;

  function snapshot() {
    return {
      drawings: app.canvas.serialize(),
      objects: app.objects.serializeAll()
    };
  }

  function sameSnapshot(a, b) {
    if (!a || !b) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function saveHistory(options = {}) {
    if (state.restoring) return;
    const next = snapshot();
    const previous = state.history[state.historyIndex];
    if (!options.force && sameSnapshot(previous, next)) {
      schedulePersist();
      return;
    }

    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(next);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.historyIndex = state.history.length - 1;
    state.dirty = true;
    app.ui.updateHistoryButtons();
    schedulePersist();
  }

  function restoreHistory(index) {
    if (index < 0 || index >= state.history.length || index === state.historyIndex) return;
    const target = state.history[index];
    const selectedId = state.selectedObject?.dataset.objectId || null;
    state.restoring = true;
    state.historyIndex = index;
    app.objects.restoreAll(target.objects || [], selectedId);
    app.canvas.restore(target.drawings || []);
    state.restoring = false;
    state.dirty = true;
    app.ui.updateHistoryButtons();
    schedulePersist();
    app.ui.renderLayerList();
  }

  function undo() { restoreHistory(state.historyIndex - 1); }
  function redo() { restoreHistory(state.historyIndex + 1); }

  function currentState() {
    return state.history[state.historyIndex] || snapshot();
  }

  function schedulePersist() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState()));
        state.dirty = false;
      } catch {
        app.ui.showToast('Kunne ikke gemme automatisk i browseren.', 3000);
      }
    }, 250);
  }

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.objects) || !Array.isArray(parsed.drawings)) return false;
      state.restoring = true;
      app.objects.restoreAll(parsed.objects);
      app.canvas.restore(parsed.drawings);
      state.restoring = false;
      state.history = [parsed];
      state.historyIndex = 0;
      state.dirty = false;
      app.ui.updateHistoryButtons();
      return true;
    } catch {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return false;
    }
  }

  function clearSavedState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  app.history = { saveHistory, restoreHistory, undo, redo, loadSavedState, clearSavedState, currentState };
})();
