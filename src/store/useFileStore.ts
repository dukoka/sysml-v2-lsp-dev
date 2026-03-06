import { useSyncExternalStore } from 'react';
import { fileStore, type FileStoreState } from './fileStore';

export function useFileStore(): FileStoreState {
  return useSyncExternalStore(
    (cb) => fileStore.subscribe(cb),
    () => fileStore.getState()
  );
}
