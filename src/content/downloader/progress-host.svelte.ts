import { mount, unmount } from 'svelte';
import Progress from './Progress.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';

export interface ProgressHandle {
  update(state: ProgressState): void;
  done(successMessage: string, autoCloseMs?: number): void;
  error(message: string): void;
  cancelled(): void;
  close(): void;
  onCancel(handler: () => void): void;
}

export interface ProgressState {
  title?: string;
  currentFile?: string;
  completed?: number;
  total?: number;
}

export function openProgress(initial: ProgressState = {}): ProgressHandle {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = tailwindCss;
  shadow.appendChild(style);
  const target = document.createElement('div');
  shadow.appendChild(target);

  const state = $state({
    title: initial.title ?? 'Downloading…',
    currentFile: initial.currentFile ?? '',
    completed: initial.completed ?? 0,
    total: initial.total ?? 0,
    phase: 'running' as 'running' | 'done' | 'error' | 'cancelled',
    error: '',
    successMessage: '',
    onCancel: () => {}
  });

  const app = mount(Progress, { target, props: state });

  function close() {
    unmount(app);
    host.remove();
  }

  return {
    update(s) {
      if (s.title !== undefined) state.title = s.title;
      if (s.currentFile !== undefined) state.currentFile = s.currentFile;
      if (s.completed !== undefined) state.completed = s.completed;
      if (s.total !== undefined) state.total = s.total;
    },
    done(successMessage, autoCloseMs = 4000) {
      state.phase = 'done';
      state.successMessage = successMessage;
      setTimeout(close, autoCloseMs);
    },
    error(message) {
      state.phase = 'error';
      state.error = message;
    },
    cancelled() {
      state.phase = 'cancelled';
      setTimeout(close, 1500);
    },
    close,
    onCancel(handler) {
      state.onCancel = handler;
    }
  };
}
