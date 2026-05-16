// CSS ?inline imports (Vite feature — not resolvable by tsc alone)
declare module '*.css?inline' {
  const content: string;
  export default content;
}

// turndown-plugin-gfm has no bundled types
declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export function gfm(turndown: TurndownService): void;
  export function tables(turndown: TurndownService): void;
  export function strikethrough(turndown: TurndownService): void;
}
