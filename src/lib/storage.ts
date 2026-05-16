export interface LocalStorageShape {
  sidebarDefaultOpen: boolean;
  customDomains: string[];
  courseColors: Record<string, string>;
  courseColorsFetchedAt: number;
}

const DEFAULTS: LocalStorageShape = {
  sidebarDefaultOpen: true,
  customDomains: [],
  courseColors: {},
  courseColorsFetchedAt: 0
};

export async function getLocal<K extends keyof LocalStorageShape>(key: K): Promise<LocalStorageShape[K]> {
  const result = await chrome.storage.local.get(key);
  return (result[key] ?? DEFAULTS[key]) as LocalStorageShape[K];
}

export async function setLocal<K extends keyof LocalStorageShape>(key: K, value: LocalStorageShape[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export interface SessionStorageShape {
  plannerCache: { items: unknown[]; fetchedAt: number } | null;
}

export async function getSession<K extends keyof SessionStorageShape>(key: K): Promise<SessionStorageShape[K]> {
  // Session storage from content scripts requires the service worker to have run
  // setAccessLevel(TRUSTED_AND_UNTRUSTED_CONTEXTS). On the first page load after
  // install, the SW may not have done so yet — treat as cache miss in that case.
  try {
    const result = await chrome.storage.session.get(key);
    return (result[key] ?? null) as SessionStorageShape[K];
  } catch {
    return null as SessionStorageShape[K];
  }
}

export async function setSession<K extends keyof SessionStorageShape>(key: K, value: SessionStorageShape[K]): Promise<void> {
  try {
    await chrome.storage.session.set({ [key]: value });
  } catch {
    // Swallow — cache will be re-attempted on next planner refresh.
  }
}
