/*
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { usePublishAssets } from './usePublishAssets';

vi.mock('../../../../apis/MCP/mcpProxiesApis', () => ({
  mcpProxiesApis: { saveMcpProxyApiPortalDraftLandingPage: vi.fn(), saveMcpProxyApiPortalDraftThumbnail: vi.fn() },
}));

const saveThumbnail = vi.mocked(mcpProxiesApis.saveMcpProxyApiPortalDraftThumbnail);
const saveLandingPage = vi.mocked(mcpProxiesApis.saveMcpProxyApiPortalDraftLandingPage);
const image = (name: string) => new Blob([name], { type: 'image/png' });

const open = (seed: Parameters<ReturnType<typeof usePublishAssets>['seed']>[0] = {}) => {
  const hook = renderHook(() => usePublishAssets('hub', 'travel'));
  act(() => hook.result.current.seed(seed));
  return hook;
};

beforeEach(() => {
  saveThumbnail.mockReset().mockResolvedValue(undefined);
  saveLandingPage.mockReset().mockResolvedValue(undefined);
});

describe('usePublishAssets thumbnail', () => {
  it('opens on the seeded thumbnail, which is not an edit', () => {
    const blob = image('a');
    const { result } = open({ thumbnail: { blob, inDraft: false } });
    expect(result.current.thumbnail).toBe(blob);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('saves nothing when there is no thumbnail, or the draft already stores the one shown', async () => {
    const empty = open();
    await act(() => empty.result.current.saveThumbnail());
    const stored = open({ thumbnail: { blob: image('a'), inDraft: true } });
    await act(() => stored.result.current.saveThumbnail());
    expect(saveThumbnail).not.toHaveBeenCalled();
  });

  it('sends a thumbnail the draft does not store yet, even one pre-filled from the live listing', async () => {
    const blob = image('live');
    const { result } = open({ thumbnail: { blob, inDraft: false } });
    await act(() => result.current.saveThumbnail());
    expect(saveThumbnail).toHaveBeenCalledWith('hub', 'travel', blob, expect.any(String));
  });

  it('counts a picked image as an edit until it is saved, and sends it only once', async () => {
    const { result } = open({ thumbnail: { blob: image('a'), inDraft: true } });
    const picked = image('b');
    act(() => result.current.setThumbnail(picked));
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(() => result.current.saveThumbnail());
    expect(saveThumbnail).toHaveBeenCalledTimes(1);
    expect(result.current.hasUnsavedChanges).toBe(false);

    await act(() => result.current.saveThumbnail());
    expect(saveThumbnail).toHaveBeenCalledTimes(1);
  });

  it('drops an image the server refuses for the last saved one, and reports the failure', async () => {
    const saved = image('a');
    const { result } = open({ thumbnail: { blob: saved, inDraft: true } });
    act(() => result.current.setThumbnail(image('bad')));
    saveThumbnail.mockRejectedValue(new Error('unsupported'));

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.saveThumbnail();
      } catch (error) {
        failure = error;
      }
    });
    expect(failure).toEqual(new Error('unsupported'));
    expect(result.current.thumbnail).toBe(saved);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});

describe('usePublishAssets landing page', () => {
  it('has none until one is seeded or created', () => {
    const { result } = open();
    expect(result.current.landingPage).toBeUndefined();
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('opens on the seeded page, which is not an edit, and says when it could not be read', () => {
    const { result } = open({ landingPage: { text: '# Travel', inDraft: true } });
    expect(result.current.landingPage).toBe('# Travel');
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.landingPageFailed).toBe(false);

    const failed = open({ landingPageFailed: true });
    expect(failed.result.current.landingPageFailed).toBe(true);
  });

  it('saves nothing without a page, or when the draft already stores the one shown', async () => {
    const empty = open();
    await act(() => empty.result.current.saveLandingPage());
    const stored = open({ landingPage: { text: '# Travel', inDraft: true } });
    await act(() => stored.result.current.saveLandingPage());
    expect(saveLandingPage).not.toHaveBeenCalled();
  });

  it('sends a page the draft does not store yet, even one pre-filled from the live listing', async () => {
    const { result } = open({ landingPage: { text: '# Live', inDraft: false } });
    await act(() => result.current.saveLandingPage());
    expect(saveLandingPage).toHaveBeenCalledWith('hub', 'travel', '# Live', expect.any(String));
  });

  it('counts an edit until it is saved, and sends it only once', async () => {
    const { result } = open({ landingPage: { text: '# Travel', inDraft: true } });
    act(() => result.current.setLandingPage('# Travel\n\nMore'));
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(() => result.current.saveLandingPage());
    expect(saveLandingPage).toHaveBeenCalledTimes(1);
    expect(result.current.hasUnsavedChanges).toBe(false);

    await act(() => result.current.saveLandingPage());
    expect(saveLandingPage).toHaveBeenCalledTimes(1);
  });

  it('keeps the edit when the save fails, so it can be tried again', async () => {
    const { result } = open({ landingPage: { text: '# Travel', inDraft: true } });
    act(() => result.current.setLandingPage('# Edited'));
    saveLandingPage.mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      await expect(result.current.saveLandingPage()).rejects.toThrow('boom');
    });
    expect(result.current.landingPage).toBe('# Edited');
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('knows a generated page until it is edited', () => {
    const { result } = open();
    act(() => result.current.createLandingPage('## Overview\n'));
    expect(result.current.landingPage).toBe('## Overview\n');
    expect(result.current.generatedLandingPage).toBe(true);
    expect(result.current.hasUnsavedChanges).toBe(true);

    act(() => result.current.setLandingPage('## Overview\n\nMore'));
    expect(result.current.generatedLandingPage).toBe(false);
  });
});
