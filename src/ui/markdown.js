const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ESCAPE[ch] || ch);

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

/**
 * 极简 Markdown：标题 / 无序列表 / 引用 / 段落 / 行内 code、bold、链接。
 * 不支持表格与代码块（博客正文用不到，引进来就要处理转义边界）。
 */
export function renderMarkdown(source) {
  const lines = String(source || '').split(/\r?\n/);
  const out = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      out.push('</ul>');
      listOpen = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      closeList();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      closeList();
      out.push(`<h2>${inline(line.slice(2))}</h2>`);
    } else if (line.startsWith('- ')) {
      if (!listOpen) {
        out.push('<ul>');
        listOpen = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line.startsWith('> ')) {
      closeList();
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (!listOpen) {
        out.push('<ul>');
        listOpen = true;
      }
      out.push(`<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}
