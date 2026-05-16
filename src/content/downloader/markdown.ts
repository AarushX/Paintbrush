import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export interface CanvasFileRef {
  fileId: number;
  originalUrl: string;
  attribute: 'href' | 'src';
}

const FILE_URL_PATTERN = /\/(?:courses\/\d+\/)?(?:users\/\d+\/)?files\/(\d+)\b/;

export function extractCanvasFileRefs(html: string): CanvasFileRef[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const refs: CanvasFileRef[] = [];
  doc.querySelectorAll('a[href], img[src]').forEach((el) => {
    const attr: 'href' | 'src' = el.tagName === 'IMG' ? 'src' : 'href';
    const value = el.getAttribute(attr);
    if (!value) return;
    const m = value.match(FILE_URL_PATTERN);
    if (m) refs.push({ fileId: Number(m[1]), originalUrl: value, attribute: attr });
  });
  return refs;
}

function preprocessHtml(html: string): string {
  // Replace iframes via regex BEFORE parsing, to prevent happy-dom from loading them
  const withoutIframes = html.replace(
    /<iframe\b([^>]*)>([\s\S]*?)<\/iframe>/gi,
    (_, attrs) => {
      const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
      const src = srcMatch ? srcMatch[1] : '';
      return `<a href="${src}">Embedded content — view on Canvas</a>`;
    }
  );
  const doc = new DOMParser().parseFromString(withoutIframes, 'text/html');
  // Unwrap Canvas's .user_content wrapper
  doc.querySelectorAll('.user_content').forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
  return doc.body.innerHTML;
}

let cachedService: TurndownService | null = null;

function getService(): TurndownService {
  if (cachedService) return cachedService;
  const s = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_'
  });
  s.use(gfm);
  // Override list item rule to use single space after marker (turndown default uses 3 spaces)
  s.addRule('listItemSingleSpace', {
    filter: 'li',
    replacement(content, node, options) {
      const clean = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/\n/gm, '\n    ');
      const parent = node.parentNode as Element | null;
      let prefix: string;
      if (parent && parent.nodeName === 'OL') {
        const start = parent.getAttribute('start');
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + index : index + 1) + '. ';
      } else {
        prefix = options.bulletListMarker + ' ';
      }
      const tail = (node as Element).nextSibling && !/\n$/.test(clean) ? '\n' : '';
      return prefix + clean + tail;
    }
  });
  cachedService = s;
  return s;
}

export function htmlToMarkdown(html: string): string {
  const pre = preprocessHtml(html);
  return getService().turndown(pre).trim() + '\n';
}

export interface RewriteOptions {
  resolveAssetPath: (fileId: number) => string;
}

export function rewriteCanvasFileLinks(html: string, opts: RewriteOptions): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('a[href], img[src]').forEach((el) => {
    const attr: 'href' | 'src' = el.tagName === 'IMG' ? 'src' : 'href';
    const value = el.getAttribute(attr);
    if (!value) return;
    const m = value.match(FILE_URL_PATTERN);
    if (m) {
      el.setAttribute(attr, opts.resolveAssetPath(Number(m[1])));
    }
  });
  return doc.body.innerHTML;
}
