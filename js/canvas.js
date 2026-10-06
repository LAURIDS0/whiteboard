(() => {
  const app = window.LCWhiteboard;
  const { dom, ctx, state } = app;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pointToSegmentDistance = (point, a, b) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSq = abx * abx + aby * aby;
    if (!lengthSq) return distance(point, a);
    const t = clamp(((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSq, 0, 1);
    return distance(point, { x: a.x + abx * t, y: a.y + aby * t });
  };

  function getPoint(event) {
    const bounds = dom.canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function resizeCanvas(preserve = true) {
    const previous = preserve && dom.canvas.width && dom.canvas.height ? captureCanvasBitmap() : null;
    const cssWidth = Math.max(1, dom.canvas.clientWidth);
    const cssHeight = Math.max(1, dom.canvas.clientHeight);
    const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

    state.canvasCssWidth = cssWidth;
    state.canvasCssHeight = cssHeight;
    state.pixelRatio = ratio;
    dom.canvas.width = Math.round(cssWidth * ratio);
    dom.canvas.height = Math.round(cssHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (previous) {
      ctx.drawImage(previous, 0, 0, cssWidth, cssHeight);
    } else {
      redraw();
    }
    app.objects?.clampAllToBoard?.();
  }

  function captureCanvasBitmap() {
    const image = document.createElement('canvas');
    image.width = dom.canvas.width;
    image.height = dom.canvas.height;
    image.getContext('2d').drawImage(dom.canvas, 0, 0);
    return image;
  }

  function setupContext(alpha = 1, strokeStyle = state.color, width = state.lineWidth, dashed = false) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = strokeStyle;
    ctx.fillStyle = strokeStyle;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dashed ? [2, Math.max(5, width * 2.4)] : []);
  }

  function renderPath(points, options = {}) {
    if (!points?.length) return;
    setupContext(options.opacity ?? 1, options.color ?? state.color, options.width ?? state.lineWidth, options.dashed ?? false);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    if (points.length === 1) {
      ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
    }
    ctx.stroke();
  }

  function renderLine(item) {
    const { from, to, style } = item;
    setupContext(item.opacity, item.color, item.width, style === 'dotted');
    drawLineGeometry(from, to, style, item.width);
  }

  function drawLineGeometry(from, to, style, width) {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    if (style === 'parallel') {
      const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const offset = Math.max(6, width * 2.2);
      const offsetX = ((to.y - from.y) / length) * offset;
      const offsetY = ((from.x - to.x) / length) * offset;
      ctx.beginPath();
      ctx.moveTo(from.x + offsetX, from.y + offsetY);
      ctx.lineTo(to.x + offsetX, to.y + offsetY);
      ctx.stroke();
    }

    if (style === 'arrow') {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const size = Math.max(9, width * 2.7);
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  }

  function renderShape(item) {
    const x = Math.min(item.from.x, item.to.x);
    const y = Math.min(item.from.y, item.to.y);
    const width = Math.abs(item.to.x - item.from.x);
    const height = Math.abs(item.to.y - item.from.y);

    setupContext(item.opacity, item.color, item.width, false);
    ctx.beginPath();

    if (item.shape === 'rectangle') {
      ctx.rect(x, y, width, height);
    } else if (item.shape === 'circle') {
      ctx.ellipse(x + width / 2, y + height / 2, Math.max(width / 2, 0.5), Math.max(height / 2, 0.5), 0, 0, Math.PI * 2);
    } else if (item.shape === 'triangle') {
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
    } else if (item.shape === 'star') {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const outer = Math.max(1, Math.min(width, height) / 2);
      const inner = outer * 0.45;
      for (let index = 0; index < 10; index += 1) {
        const angle = -Math.PI / 2 + index * Math.PI / 5;
        const radius = index % 2 === 0 ? outer : inner;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.stroke();
  }

  function redraw(includePreview = true) {
    ctx.save();
    ctx.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, state.canvasCssWidth, state.canvasCssHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, state.canvasCssWidth, state.canvasCssHeight);

    state.drawings.forEach((item) => {
      if (item.kind === 'stroke') renderPath(item.points, item);
      if (item.kind === 'line') renderLine(item);
      if (item.kind === 'shape') renderShape(item);
    });

    if (includePreview && state.isPointerActive && state.pointerStart) {
      if (['line', 'shape'].includes(state.activeTool) && state.currentPoints[0]) {
        const previewTo = state.currentPoints[state.currentPoints.length - 1];
        if (state.activeTool === 'line') {
          const preview = { from: state.pointerStart, to: previewTo, style: state.lineStyle, color: state.color, opacity: state.opacity, width: state.lineWidth };
          renderLine(preview);
        } else {
          const preview = { from: state.pointerStart, to: previewTo, shape: state.shapeType, color: state.color, opacity: state.opacity, width: state.lineWidth };
          renderShape(preview);
        }
      }
      if (state.activeTool === 'draw' && state.currentPoints.length) {
        const previewOpacity = state.drawMode === 'marker' ? Math.min(state.opacity, 0.35) : state.opacity;
        const previewWidth = state.drawMode === 'brush' ? state.lineWidth * 2.5 : state.lineWidth;
        renderPath(state.currentPoints, { color: state.color, opacity: previewOpacity, width: previewWidth });
      }
    }
    ctx.restore();
  }

  function addDrawing(item) {
    const normalized = { ...item, id: `drawing-${++state.drawingCounter}` };
    state.drawings.push(normalized);
    redraw(false);
    app.history.saveHistory();
  }

  function hitTestDrawing(point, tolerance = state.eraserSize) {
    for (let index = state.drawings.length - 1; index >= 0; index -= 1) {
      const item = state.drawings[index];
      if (item.kind === 'stroke') {
        for (let pointIndex = 1; pointIndex < item.points.length; pointIndex += 1) {
          if (pointToSegmentDistance(point, item.points[pointIndex - 1], item.points[pointIndex]) <= tolerance) return index;
        }
        if (item.points.length === 1 && distance(point, item.points[0]) <= tolerance) return index;
      } else if (item.kind === 'line') {
        if (pointToSegmentDistance(point, item.from, item.to) <= tolerance) return index;
      } else if (item.kind === 'shape') {
        const x = Math.min(item.from.x, item.to.x);
        const y = Math.min(item.from.y, item.to.y);
        const w = Math.abs(item.to.x - item.from.x);
        const h = Math.abs(item.to.y - item.from.y);
        const inside = point.x >= x - tolerance && point.x <= x + w + tolerance && point.y >= y - tolerance && point.y <= y + h + tolerance;
        if (inside) return index;
      }
    }
    return -1;
  }

  function eraseAt(point, commitHistory = true) {
    const index = hitTestDrawing(point);
    if (index === -1) return false;
    state.drawings.splice(index, 1);
    redraw(false);
    if (commitHistory) app.history.saveHistory();
    return true;
  }

  function pickColorAt(point) {
    const pixel = ctx.getImageData(Math.floor(point.x * state.pixelRatio), Math.floor(point.y * state.pixelRatio), 1, 1).data;
    if (pixel[3] === 0) return;
    state.color = `#${[pixel[0], pixel[1], pixel[2]].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    state.drawMode = 'pencil';
    state.activeTool = 'draw';
    app.ui?.showToast(`Farve valgt: ${state.color}`);
    app.ui?.setCanvasCursor('crosshair');
  }

  function startDrawing(event) {
    const point = getPoint(event);

    if (state.activeTool === 'select') {
      app.objects.selectObject(null);
      return;
    }

    if (state.activeTool === 'pipette') {
      pickColorAt(point);
      return;
    }

    if (state.activeTool === 'erase') {
      if (state.eraseMode === 'lines') {
        state.isPointerActive = true;
        state.pointerId = event.pointerId;
        state.eraseChanged = eraseAt(point, false);
        state.lastErasePoint = point;
        dom.canvas.setPointerCapture(event.pointerId);
      }
      return;
    }

    if (!['draw', 'line', 'shape'].includes(state.activeTool)) return;

    state.isPointerActive = true;
    state.pointerId = event.pointerId;
    state.pointerStart = point;
    state.currentPoints = [point];
    dom.canvas.setPointerCapture(event.pointerId);
    redraw();
  }

  function draw(event) {
    if (!state.isPointerActive || state.pointerId !== event.pointerId) return;
    const point = getPoint(event);
    if (state.activeTool === 'erase' && state.eraseMode === 'lines') {
      if (state.lastErasePoint) {
        const steps = Math.max(1, Math.ceil(Math.hypot(point.x - state.lastErasePoint.x, point.y - state.lastErasePoint.y) / Math.max(4, state.eraserSize / 2)));
        for (let step = 1; step <= steps; step += 1) {
          const t = step / steps;
          const sample = {
            x: state.lastErasePoint.x + (point.x - state.lastErasePoint.x) * t,
            y: state.lastErasePoint.y + (point.y - state.lastErasePoint.y) * t
          };
          if (eraseAt(sample, false)) state.eraseChanged = true;
        }
      } else if (eraseAt(point, false)) {
        state.eraseChanged = true;
      }
      state.lastErasePoint = point;
      return;
    }
    if (state.activeTool === 'draw') {
      state.currentPoints.push(point);
      redraw();
      return;
    }
    if (state.activeTool === 'line' || state.activeTool === 'shape') {
      state.currentPoints = [point];
      redraw();
    }
  }

  function stopDrawing(event) {
    if (!state.isPointerActive || (event && event.pointerId !== state.pointerId)) return;
    const finalPoints = [...state.currentPoints];
    const endPoint = finalPoints[finalPoints.length - 1] || state.pointerStart;
    const start = state.pointerStart;
    const eraseChanged = state.eraseChanged;
    const activeTool = state.activeTool;
    state.isPointerActive = false;
    state.pointerId = null;
    state.pointerStart = null;
    state.currentPoints = [];
    state.lastErasePoint = null;
    state.eraseChanged = false;

    if (activeTool === 'erase' && state.eraseMode === 'lines') {
      if (eraseChanged) app.history.saveHistory();
      return;
    }

    if (start && endPoint) {
      if (activeTool === 'draw') {
        const points = finalPoints.length ? finalPoints : [start, endPoint];
        addDrawing({ kind: 'stroke', points: points.length > 1 ? points : [start, endPoint], color: state.color, opacity: state.drawMode === 'marker' ? Math.min(state.opacity, 0.35) : state.opacity, width: state.drawMode === 'brush' ? state.lineWidth * 2.5 : state.lineWidth });
      } else if (state.activeTool === 'line' && Math.hypot(endPoint.x - start.x, endPoint.y - start.y) >= 2) {
        addDrawing({ kind: 'line', from: start, to: endPoint, style: state.lineStyle, color: state.color, opacity: state.opacity, width: state.lineWidth });
      } else if (state.activeTool === 'shape' && Math.hypot(endPoint.x - start.x, endPoint.y - start.y) >= 2) {
        addDrawing({ kind: 'shape', from: start, to: endPoint, shape: state.shapeType, color: state.color, opacity: state.opacity, width: state.lineWidth });
      }
    }
    redraw(false);
  }

  function updateCursor() {
    if (state.activeTool === 'draw' || state.activeTool === 'line' || state.activeTool === 'shape' || state.activeTool === 'pipette') {
      app.ui?.setCanvasCursor('crosshair');
    } else if (state.activeTool === 'erase') {
      app.ui?.setCanvasCursor('crosshair');
    } else {
      app.ui?.setCanvasCursor('default');
    }
  }

  function serialize() {
    return JSON.parse(JSON.stringify(state.drawings));
  }

  function restore(drawings) {
    state.drawings = Array.isArray(drawings) ? drawings : [];
    state.drawingCounter = state.drawings.reduce((highest, item) => {
      const number = Number(String(item.id || '').replace('drawing-', ''));
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 0);
    redraw(false);
  }

  dom.canvas.addEventListener('pointerdown', startDrawing);
  dom.canvas.addEventListener('pointermove', draw);
  dom.canvas.addEventListener('pointerup', stopDrawing);
  dom.canvas.addEventListener('pointercancel', stopDrawing);

  window.addEventListener('resize', () => resizeCanvas(true));

  app.canvas = { resizeCanvas, redraw, addDrawing, eraseAt, hitTestDrawing, pickColorAt, serialize, restore, getPoint, updateCursor };
})();
