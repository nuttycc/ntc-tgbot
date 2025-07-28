import { freeStorage } from '@grammyjs/storage-free';
import type { StorageAdapter } from 'grammy';

// Patch freeStorage to readAllKeys
export function patchedFreeStorage<S>(token: string): StorageAdapter<S> {
  const store = freeStorage<S>(token);
  return {
    ...store,
    /**
     * Returns all keys in storage.
     * @note FreeStorage doesn't support key listing, so this returns an empty generator.
     * @throws {Error} Always throws an error since FreeStorage doesn't support key listing.
     */
    readAllKeys: async function* () {
      throw new Error('readAllKeys is not supported by FreeStorage');
    },
  };
}
