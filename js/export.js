(() => {
  const app = window.LCWhiteboard;
  const { dom, ctx, state } = app;

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawText(context, text, x, y, maxWidth, lineHeight, maxLines = 8) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((entry, index) => context.fillText(entry, x, y + index * lineHeight));
  }

  async function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  async function exportWhiteboard() {
    const width = state.canvasCssWidth;
    const height = state.canvasCssHeight;
    const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.round(width * ratio);
    exportCanvas.height = Math.round(height * ratio);
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    exportCtx.fillStyle = '#fff';
    exportCtx.fillRect(0, 0, width, height);
    exportCtx.drawImage(dom.canvas, 0, 0, width, height);

    const objects = [...dom.objectLayer.children];
    for (const object of objects) {
      const left = object.offsetLeft;
      const top = object.offsetTop;
      const w = object.offsetWidth;
      const h = object.offsetHeight;
      const rotation = Number(object.dataset.rotation || 0);
      const opacity = Number(object.dataset.opacity || 1);
      exportCtx.save();
      exportCtx.translate(left + w / 2, top + h / 2);
      exportCtx.rotate((rotation * Math.PI) / 180);
      exportCtx.globalAlpha = opacity;

      if (object.classList.contains('image')) {
        try {
          const image = await loadImage(object.dataset.source || '');
          exportCtx.drawImage(image, -w / 2, -h / 2, w, h);
        } catch {
          exportCtx.fillStyle = '#fff1f2';
          exportCtx.strokeStyle = '#bd3e49';
          exportCtx.lineWidth = 1;
          roundedRect(exportCtx, -w / 2, -h / 2, w, h, 10);
          exportCtx.fill();
          exportCtx.stroke();
          exportCtx.fillStyle = '#bd3e49';
          exportCtx.font = '12px sans-serif';
          exportCtx.fillText('Billede kunne ikke indlæses', -w / 2 + 10, 4);
        }
      } else if (object.classList.contains('note')) {
        exportCtx.fillStyle = object.classList.contains('checklist') ? '#dff4e8' : object.classList.contains('paper') ? '#fff' : object.classList.contains('text') ? '#fff' : '#fff5ae';
        roundedRect(exportCtx, -w / 2, -h / 2, w, h, 10);
        exportCtx.fill();
        exportCtx.strokeStyle = 'rgb(23 32 51 / 12%)';
        exportCtx.lineWidth = 1;
        exportCtx.stroke();

        exportCtx.textAlign = 'left';
        exportCtx.fillStyle = '#172033';
        exportCtx.font = '700 13px sans-serif';
        drawText(exportCtx, object.querySelector('.note-title')?.textContent, -w / 2 + 12, -h / 2 + 24, w - 24, 16, 3);

        exportCtx.font = '12px sans-serif';
        exportCtx.fillStyle = 'rgb(23 32 51 / 72%)';
        if (object.classList.contains('checklist')) {
          [...object.querySelectorAll('.checklist-item')].forEach((row, index) => {
            const y = -h / 2 + 48 + index * 20;
            exportCtx.strokeStyle = '#2f8b63';
            exportCtx.strokeRect(-w / 2 + 12, y - 9, 10, 10);
            if (row.querySelector('input')?.checked) {
              exportCtx.beginPath();
              exportCtx.moveTo(-w / 2 + 14, y - 4);
              exportCtx.lineTo(-w / 2 + 17, y - 1);
              exportCtx.lineTo(-w / 2 + 21, y - 7);
              exportCtx.stroke();
            }
            exportCtx.fillStyle = '#172033';
            exportCtx.fillText(row.querySelector('span')?.textContent || '', -w / 2 + 28, y);
          });
        } else {
          drawText(exportCtx, object.querySelector('.note-body')?.textContent, -w / 2 + 12, -h / 2 + 50, w - 24, 16, 8);
        }
      }
      exportCtx.restore();
    }

    const link = document.createElement('a');
    link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    app.ui.showToast('Whiteboard gemt som PNG.');
  }

  app.exporter = { exportWhiteboard };
})();
