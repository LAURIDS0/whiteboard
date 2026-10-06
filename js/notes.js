(() => {
  const app = window.LCWhiteboard;
  const { state } = app;

  const TYPES = {
    sticky: { label: 'Gul note', className: 'note-sticky' },
    paper: { label: 'Papirnote', className: 'note-paper' },
    checklist: { label: 'Tjekliste', className: 'note-checklist' },
    text: { label: 'Tekstnote', className: 'note-text' }
  };

  function normalizeType(type) {
    return TYPES[type] ? type : 'sticky';
  }

  function createEditable(className, value = '') {
    const element = document.createElement('div');
    element.className = className;
    element.contentEditable = 'true';
    element.spellcheck = false;
    element.textContent = value;
    return element;
  }

  function addHistoryOnBlur(element) {
    element.addEventListener('blur', () => app.history.saveHistory());
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderInlineMarkdown(value = '') {
    let text = escapeHtml(value);
    const tokens = [];
    const token = (html) => {
      const id = tokens.push(html) - 1;
      return `\uE000${id}\uE001`;
    };

    text = text.replace(/`([^`]+)`/g, (_, code) => token(`<code>${code}</code>`));
    text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');

    return text.replace(/\uE000(\d+)\uE001/g, (_, index) => tokens[Number(index)] || '');
  }

  function renderMarkdown(source = '') {
    const normalized = String(source).replace(/\r\n?/g, '\n');
    if (!normalized.trim()) return '';

    const lines = normalized.split('\n');
    const output = [];
    let paragraph = [];
    let listType = null;
    let listItems = [];
    let inCode = false;
    let codeLines = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${paragraph.map(renderInlineMarkdown).join('<br>')}</p>`);
      paragraph = [];
    };

    const flushList = () => {
      if (!listType || !listItems.length) return;
      const tag = listType === 'ol' ? 'ol' : 'ul';
      output.push(`<${tag}>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</${tag}>`);
      listType = null;
      listItems = [];
    };

    const flushCode = () => {
      output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      codeLines = [];
      inCode = false;
    };

    for (const line of lines) {
      if (inCode) {
        if (/^\s*```/.test(line)) flushCode();
        else codeLines.push(line);
        continue;
      }

      if (/^\s*```/.test(line)) {
        flushParagraph();
        flushList();
        inCode = true;
        continue;
      }

      const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length;
        output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
        flushParagraph();
        flushList();
        output.push('<hr>');
        continue;
      }

      const unordered = line.match(/^\s*[-+*]\s+(.+)$/);
      if (unordered) {
        flushParagraph();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(unordered[1]);
        continue;
      }

      const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
      if (ordered) {
        flushParagraph();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(ordered[1]);
        continue;
      }

      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        flushList();
        output.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }

      flushList();
      paragraph.push(line);
    }

    if (inCode) flushCode();
    flushParagraph();
    flushList();

    return output.join('');
  }

  function getMarkdownValue(element) {
    if (!element) return '';
    if (element.matches(':focus')) {
      const raw = element.textContent || '';
      element.dataset.markdown = raw;
      return raw;
    }
    return element.dataset.markdown ?? element.textContent ?? '';
  }

  let markdownHelp = null;

  function getMarkdownHelp() {
    if (markdownHelp) return markdownHelp;

    markdownHelp = document.createElement('div');
    markdownHelp.className = 'markdown-help';
    markdownHelp.hidden = true;
    markdownHelp.setAttribute('aria-label', 'Markdown hjælp');
    markdownHelp.innerHTML = `
      <div class="markdown-help-title">
        <i class="fa-solid fa-hashtag"></i>
        <span>Markdown</span>
      </div>
      <div class="markdown-help-grid">
        <div><code># tekst</code><span>Overskrift</span></div>
        <div><code>**tekst**</code><span>Fed</span></div>
        <div><code>*tekst*</code><span>Kursiv</span></div>
        <div><code>- tekst</code><span>Punktliste</span></div>
        <div><code>1. tekst</code><span>Nummereret liste</span></div>
        <div><code>&gt; tekst</code><span>Citat</span></div>
        <div><code>\`kode\`</code><span>Inline kode</span></div>
        <div><code>\`\`\`</code><span>Kodeblok</span></div>
      </div>
    `;
    document.body.append(markdownHelp);
    return markdownHelp;
  }

  function showMarkdownHelp() {
    getMarkdownHelp().hidden = false;
  }

  function hideMarkdownHelp() {
    if (markdownHelp) markdownHelp.hidden = true;
  }
  function setupMarkdownBody(element, value = '') {
    element.dataset.markdown = value;
    element.classList.add('markdown-editor');

    const renderPreview = () => {
      const raw = element.textContent || '';
      element.dataset.markdown = raw;
      element.innerHTML = renderMarkdown(raw);
      element.classList.remove('is-editing');
    };

    element.addEventListener('focus', () => {
      const raw = element.dataset.markdown ?? '';
      element.classList.add('is-editing');
      element.textContent = raw;
      showMarkdownHelp();
    });

    element.addEventListener('input', () => {
      element.dataset.markdown = element.textContent || '';
    });

    element.addEventListener('blur', () => {
      renderPreview();
      hideMarkdownHelp();
    });

    element.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        document.execCommand('insertText', false, '  ');
        element.dataset.markdown = element.textContent || '';
        return;
      }

      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

      event.preventDefault();

      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      if (!element.contains(range.commonAncestorContainer)) return;

      range.deleteContents();

      const newline = document.createTextNode('\n');
      range.insertNode(newline);
      range.setStartAfter(newline);
      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);

      element.dataset.markdown = element.textContent || '';
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertLineBreak', data: '\n' }));
    });

    renderPreview();
    return element;
  }

  function createChecklistTitle(value = '') {
    const element = createEditable('note-checklist-title', value);
    element.dataset.placeholder = 'Overskrift';
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const first = element.closest('.note-content')?.querySelector('.note-checklist-text');
      first?.focus();
    });
    addHistoryOnBlur(element);
    return element;
  }

  function createChecklistItem(data = {}) {
    const row = document.createElement('div');
    const checkbox = document.createElement('input');
    const text = createEditable('note-checklist-text', data.text || '');

    row.className = 'note-checklist-item';
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(data.checked);
    checkbox.setAttribute('aria-label', 'Marker opgave som færdig');

    checkbox.addEventListener('change', () => app.history.saveHistory());
    text.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const next = createChecklistItem();
      row.parentElement?.insertBefore(next, row.nextSibling);
      next.querySelector('.note-checklist-text')?.focus();
    });
    text.addEventListener('keydown', (event) => {
      if (event.key !== 'Backspace' || text.textContent.trim()) return;
      const rows = [...row.parentElement.children];
      if (rows.length <= 1) return;
      event.preventDefault();
      const previous = row.previousElementSibling;
      row.remove();
      previous?.querySelector('.note-checklist-text')?.focus();
      app.history.saveHistory();
    });
    addHistoryOnBlur(text);

    row.append(checkbox, text);
    return row;
  }

  function render(object, data = {}) {
    const type = normalizeType(data.noteType || data.type || object.dataset.noteType);
    const config = TYPES[type];

    object.dataset.noteType = type;
    object.classList.add('note', config.className);
    object.classList.remove('sticky', 'paper', 'checklist', 'text');
    object.style.background = 'transparent';
    object.style.border = '0';
    object.style.boxShadow = 'none';

    const content = document.createElement('div');
    content.className = 'note-content';

    if (type === 'checklist') {
      const title = createChecklistTitle(data.heading || data.title || '');
      const list = document.createElement('div');
      list.className = 'note-checklist';
      const items = Array.isArray(data.items) && data.items.length ? data.items : [{ text: '', checked: false }];
      items.forEach((item) => list.append(createChecklistItem(item)));
      content.append(title, list);

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'note-add-item';
      add.innerHTML = '<i class="fa-solid fa-plus"></i><span>Tilføj linje</span>';
      add.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const item = createChecklistItem();
        list.append(item);
        app.history.saveHistory();
        item.querySelector('.note-checklist-text')?.focus();
      });
      content.append(add);
    } else {
      const body = createEditable('note-body', data.body || '');
      body.dataset.placeholder = 'Tryk her for at skrive';
      setupMarkdownBody(body, data.body || '');
      addHistoryOnBlur(body);
      content.append(body);
    }

    object.replaceChildren(content);
    return object;
  }

  function create(type = 'sticky') {
    const noteType = normalizeType(type);
    const object = app.objects.createObject('note', {
      noteType,
      label: TYPES[noteType].label,
      body: '',
      heading: noteType === 'checklist' ? '' : undefined,
      items: noteType === 'checklist' ? [{ text: '', checked: false }] : undefined
    });

    requestAnimationFrame(() => {
      const editor = noteType === 'checklist'
        ? object.querySelector('.note-checklist-title')
        : object.querySelector('.note-body');
      editor?.focus();
    });

    return object;
  }

  function serialize(object) {
    const noteType = normalizeType(object.dataset.noteType);
    const result = {
      noteType
    };

    if (noteType === 'checklist') {
      result.heading = object.querySelector('.note-checklist-title')?.textContent || '';
      result.items = [...object.querySelectorAll('.note-checklist-item')].map((row) => ({
        text: row.querySelector('.note-checklist-text')?.textContent || '',
        checked: Boolean(row.querySelector('input')?.checked)
      }));
    } else {
      result.body = getMarkdownValue(object.querySelector('.note-body'));
    }

    return result;
  }

  function getLabel(object) {
    return TYPES[normalizeType(object.dataset.noteType)].label;
  }

  function getTypeLabel(type) {
    return TYPES[normalizeType(type)].label;
  }

  app.notes = {
    TYPES,
    render,
    create,
    serialize,
    getLabel,
    getTypeLabel,
    normalizeType,
    renderMarkdown
  };
})();
