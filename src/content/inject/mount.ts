import { mount } from 'svelte';
import Sidebar from '../sidebar/Sidebar.svelte';
import tailwindCss from '../../styles/tailwind.css?inline';
import { getLocal } from '../../lib/storage';

const HOST_ID = 'paintbrush-root';

export async function mountSidebar(): Promise<() => void> {
  if (document.getElementById(HOST_ID)) {
    return () => {}; // already mounted
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all: initial; position: fixed; inset: 0 0 auto auto; pointer-events: none; z-index: 2147483647;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = tailwindCss;
  shadow.appendChild(styleEl);

  const appRoot = document.createElement('div');
  appRoot.style.cssText = 'pointer-events: auto;';
  shadow.appendChild(appRoot);

  const defaultOpen = await getLocal('sidebarDefaultOpen');
  const app = mount(Sidebar, { target: appRoot, props: { open: defaultOpen } });

  return () => {
    host.remove();
    void app;
  };
}
