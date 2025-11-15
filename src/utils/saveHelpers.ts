// src/utils/saveHelpers.ts
export const hashString = (s: string) => {
  // djb2
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h >>> 0;
  }
  return String(h);
};

const storageKey = (type: 'hunters' | 'config') => `export_hash_${type}`;

export const computeHashFor = (obj: any) => {
  try {
    return hashString(JSON.stringify(obj));
  } catch {
    return '';
  }
};

export const markExported = (type: 'hunters' | 'config', obj: any) => {
  const h = computeHashFor(obj);
  if (h) localStorage.setItem(storageKey(type), h);
};

export const isExported = (type: 'hunters' | 'config', obj: any) => {
  const h = computeHashFor(obj);
  const stored = localStorage.getItem(storageKey(type));
  return Boolean(h && stored && stored === h);
};

export const getSuggestedFilename = (type: 'hunters' | 'config') => {
  const date = new Date().toISOString().slice(0,10);
  if (type === 'hunters') return `saves/hunters_${date}.json`;
  return `saves/print_config_${date}.json`;
};
