/* Provides OB data throughout the app.
   The data is intended to be read only, no changes will get synced back to storage.
   Refresh method is provided to fetch new data from storage. */

// TODO: Move to SSE & make generic

import { ipcRenderer } from 'electron';

import React, { useEffect, useContext } from 'react';

import { RendererStorage as BaseRendererStorage } from 'sse/storage/renderer';
import { RemoteStorageStatus } from 'sse/storage/main/remote';

import { Publication } from 'models/publications';
import { ITURecommendation } from 'models/recommendations';
import { RunningAnnex, getRunningAnnexesForIssue } from 'models/running-annexes';

import { RendererStorage } from 'storage/renderer';


// Of the form: { objType1: [id1, id2], objType2: [id3, id4] }
export type ModifiedObjectStatus<R extends BaseRendererStorage<any>> = {
  [K in keyof R]: (string | number)[]
}


export interface StorageContextSpec<R extends BaseRendererStorage<any>> {
  // Snapshot of all objects, per type
  current: R,
  refresh(): Promise<void>,

  // Snapshot of modified object IDs, per type
  modified: ModifiedObjectStatus<R>,
  refreshModified(hasLocalChanges?: boolean): Promise<void>,
}


export const WorkspaceContext = React.createContext<StorageContextSpec<RendererStorage>>({
  current: {
    issues: {},
    publications: {},
    recommendations: {},
  },
  refresh: async () => {},

  modified: {
    issues: [],
    publications: [],
    recommendations: [],
  },
  refreshModified: async () => {},
});


export function useWorkspace(): RendererStorage {
  const workspace = useContext(WorkspaceContext);

  useEffect(() => {
    workspace.refresh();

    ipcRenderer.once('app-loaded', workspace.refresh);
    ipcRenderer.on('publications-changed', workspace.refresh);
    ipcRenderer.on('issues-changed', workspace.refresh);

    return function cleanup() {
      ipcRenderer.removeListener('app-loaded', workspace.refresh);
      ipcRenderer.removeListener('publications-changed', workspace.refresh);
      ipcRenderer.removeListener('issues-changed', workspace.refresh);
    };
  }, []);

  return workspace.current;
}


export function useModified(): ModifiedObjectStatus<RendererStorage> {
  const workspace = useContext(WorkspaceContext);

  async function handleRemoteStorage(evt: any, remoteStorageStatus: Partial<RemoteStorageStatus>) {
    await workspace.refreshModified(remoteStorageStatus.hasLocalChanges);
  }

  useEffect(() => {
    workspace.refreshModified();
    ipcRenderer.on('remote-storage-status', handleRemoteStorage);

    return function cleanup() {
      ipcRenderer.removeListener('remote-storage-status', handleRemoteStorage);
    };
  }, []);

  return workspace.modified;
}


export function usePublication(id: string | undefined): Publication | undefined {
  if (!id) { return; }

  const ws = useWorkspace();
  return ws.publications[id];
}


export function useRecommendation(code: string | undefined): ITURecommendation | undefined {
  if (!code) { return; }

  const ws = useWorkspace();
  return ws.recommendations[code];
}


export function useLatestAnnex(issueId: number, pubId?: string): RunningAnnex | undefined {
  const previousAnnexes = useRunningAnnexes(issueId, pubId);
  if (previousAnnexes.length > 0) {
    return previousAnnexes[0];
  }
  return;
}


export function useRunningAnnexes(issueId: number, pubId?: string) {
  const workspace = useWorkspace();
  return getRunningAnnexesForIssue(issueId, workspace.issues, workspace.publications, pubId);
}
