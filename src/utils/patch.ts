import { freeStorage } from '@grammyjs/storage-free';
import type { StorageAdapter } from 'grammy';

// Patch freeStorage to readAllKeys
export function patchedFreeStorage<S>(token: string): StorageAdapter<S> {
  const store = freeStorage<S>(token);
  return {
    ...store,
    readAllKeys: async function* () {
      // FreeStorage doesn't implement listing keys, return empty
      /* you could also implement real listing here */
    },
  };
}
