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
  mcpProxiesApis: { saveMcpProxyApiPortalDraftThumbnail: vi.fn() },
}));

const saveThumbnail = vi.mocked(mcpProxiesApis.saveMcpProxyApiPortalDraftThumbnail);
const image = (name: string) => new Blob([name], { type: 'image/png' });

const open = (seed: Parameters<ReturnType<typeof usePublishAssets>['seed']>[0] = {}) => {
  const hook = renderHook(() => usePublishAssets('hub', 'travel'));
  act(() => hook.result.current.seed(seed));
  return hook;
};

beforeEach(() => {
  saveThumbnail.mockReset().mockResolvedValue(undefined);
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
