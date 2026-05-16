// Lightweight markdown subset for composer input. NOT a full markdown parser —
// we deliberately keep it small (~40 lines) and predictable.
//
// Supports: **bold**, *italic*, `code`, [text](url), paragraph breaks via blank lines.
// Auto-links bare URLs.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s: string): string {
  let out = escapeHtml(s);
  // Inline code first so its content isn't further transformed
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links [text](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Auto-link bare URLs (avoid re-linking ones already in href)
  out = out.replace(/(^|[^"=>])((?:https?:\/\/)[^\s<]+)/g, (_m, pre, url) =>
    `${pre}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic — match * not adjacent to other *
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out;
}

export function markdownToHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  // Split on blank lines into paragraphs; preserve single-line breaks inside via <br>.
  const paragraphs = trimmed.split(/\n{2,}/);
  return paragraphs
    .map(p => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
