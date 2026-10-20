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

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiPortal } from '../../../../apis/apiPortalApis';
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { usePublishPageData } from './usePublishPageData';

vi.mock('../../../../apis/apiPortalApis', () => ({ getApiPortal: vi.fn() }));
vi.mock('../../../../apis/MCP/mcpProxiesApis', () => ({
  mcpProxiesApis: {
    getMCPServer: vi.fn(),
    getMcpProxyApiPortalDraft: vi.fn(),
    getMcpProxyApiPortalPublication: vi.fn(),
    getMcpProxyApiPortalDraftDefinition: vi.fn(),
    getMcpProxyApiPortalPublicationDefinition: vi.fn(),
    getMcpProxyApiPortalDraftThumbnail: vi.fn(),
    getMcpProxyApiPortalPublicationThumbnail: vi.fn(),
    getMcpProxyApiPortalDraftLandingPage: vi.fn(),
    getMcpProxyApiPortalPublicationLandingPage: vi.fn(),
  },
}));
const gateways = vi.hoisted(() => ({ value: { gateways: [] as unknown[], isLoading: false } }));
vi.mock('../../../../hooks/useMcpDeployedGateways', () => ({ useMcpDeployedGateways: () => gateways.value }));
vi.mock('../../../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const api = vi.mocked(mcpProxiesApis);
const notFound = () => Object.assign(new Error('not found'), { status: 404 });
const serverError = () => Object.assign(new Error('boom'), { status: 500 });

const SERVER = {
  id: 'travel',
  displayName: 'Travel MCP',
  version: 'v1',
  description: 'Trip tools',
  context: '/travel',
  capabilities: { tools: [{ name: 'from-proxy' }], resources: [], prompts: [] },
};
const DRAFT = { displayName: 'Draft name', version: 'v2' };
const PUBLICATION = { displayName: 'Live name', version: 'v1', status: 'PUBLISHED' };

const load = (want = false) => renderHook(() => usePublishPageData('hub', 'travel', 'org', want));

const definitionOf = (seed: { definitionText: string } | undefined) => JSON.parse(seed!.definitionText);

beforeEach(() => {
  gateways.value = { gateways: [], isLoading: false };
  api.getMCPServer.mockReset().mockResolvedValue(SERVER as never);
  api.getMcpProxyApiPortalDraft.mockReset().mockRejectedValue(notFound());
  api.getMcpProxyApiPortalPublication.mockReset().mockRejectedValue(notFound());
  api.getMcpProxyApiPortalDraftDefinition.mockReset().mockRejectedValue(notFound());
  api.getMcpProxyApiPortalPublicationDefinition.mockReset().mockRejectedValue(notFound());
  api.getMcpProxyApiPortalDraftThumbnail.mockReset().mockRejectedValue(notFound());
  api.getMcpProxyApiPortalPublicationThumbnail.mockReset().mockRejectedValue(notFound());
  api.getMcpProxyApiPortalDraftLandingPage.mockReset().mockRejectedValue(notFound());
  api.getMcpProxyApiPortalPublicationLandingPage.mockReset().mockRejectedValue(notFound());
  vi.mocked(getApiPortal).mockReset().mockResolvedValue({ name: 'Main Hub' } as never);
});

describe('usePublishPageData', () => {
  it('starts a first publish from the proxy itself, with the first gateway URL as its Production URL', async () => {
    gateways.value = { gateways: [{ id: 'g', name: 'g', endpoints: ['gw.example.com'] }], isLoading: false };
    const { result } = load();
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.draft).toBeUndefined();
    expect(result.current.publication).toBeUndefined();
    expect(result.current.seed?.values).toMatchObject({
      displayName: 'Travel MCP',
      productionUrl: 'https://gw.example.com/travel/mcp',
    });
    expect(definitionOf(result.current.seed).tools).toEqual([{ name: 'from-proxy' }]);
    expect(result.current.productionUrlOptions).toEqual([
      { gatewayName: 'g', url: 'https://gw.example.com/travel/mcp' },
    ]);
  });

  it('opens on the draft when there is one, ahead of the live listing', async () => {
    api.getMcpProxyApiPortalDraft.mockResolvedValue(DRAFT as never);
    api.getMcpProxyApiPortalPublication.mockResolvedValue(PUBLICATION as never);
    api.getMcpProxyApiPortalDraftDefinition.mockResolvedValue({ tools: [{ name: 'from-draft' }] } as never);
    const { result } = load();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.seed?.values.displayName).toBe('Draft name');
    expect(definitionOf(result.current.seed).tools).toEqual([{ name: 'from-draft' }]);
    expect(api.getMcpProxyApiPortalPublicationDefinition).not.toHaveBeenCalled();
  });

  it('opens on the live listing\'s definition when the draft has none', async () => {
    api.getMcpProxyApiPortalPublication.mockResolvedValue(PUBLICATION as never);
    api.getMcpProxyApiPortalPublicationDefinition.mockResolvedValue({ tools: [{ name: 'live' }] } as never);
    const { result } = load();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.seed?.values.displayName).toBe('Live name');
    expect(definitionOf(result.current.seed).tools).toEqual([{ name: 'live' }]);
  });

  it('keeps fields of a stored definition that the editor does not show', async () => {
    api.getMcpProxyApiPortalDraftDefinition.mockResolvedValue({ tools: [], extra: { keep: true } } as never);
    const { result } = load();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(definitionOf(result.current.seed).extra).toEqual({ keep: true });
  });

  it('carries on without the hub\'s name when it cannot be read', async () => {
    vi.mocked(getApiPortal).mockRejectedValue(serverError());
    const { result } = load();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.portal).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.seed).toBeDefined();
  });

  it('reports a failure that is not a missing draft, and offers no seed', async () => {
    api.getMcpProxyApiPortalDraft.mockRejectedValue(serverError());
    const { result } = load();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.seed).toBeUndefined();
  });

  it('stays loading until the deployed gateways are known', async () => {
    gateways.value = { gateways: [], isLoading: true };
    const { result, rerender } = load();
    await waitFor(() => expect(api.getMCPServer).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.isLoading).toBe(true);

    gateways.value = { gateways: [], isLoading: false };
    rerender();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('reads the live definition only when it is wanted and something is live', async () => {
    api.getMcpProxyApiPortalPublication.mockResolvedValue(PUBLICATION as never);
    api.getMcpProxyApiPortalPublicationDefinition.mockResolvedValue({ tools: [{ name: 'live' }] } as never);

    const { result } = load(true);
    await waitFor(() => expect(result.current.publishedDefinition.isLoading).toBe(false));
    await waitFor(() => expect(result.current.publishedDefinition.definition).toEqual({ tools: [{ name: 'live' }] }));

    const unwanted = load(false);
    await waitFor(() => expect(unwanted.result.current.isLoading).toBe(false));
    expect(unwanted.result.current.publishedDefinition.definition).toBeUndefined();
  });

  it('never reads a live definition when nothing is live', async () => {
    const { result } = load(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getMcpProxyApiPortalPublicationDefinition).not.toHaveBeenCalled();
  });

  it('flags a live definition that cannot be read', async () => {
    api.getMcpProxyApiPortalPublication.mockResolvedValue(PUBLICATION as never);
    api.getMcpProxyApiPortalDraftDefinition.mockResolvedValue({} as never);
    api.getMcpProxyApiPortalPublicationDefinition.mockRejectedValue(serverError());
    const { result } = load(true);
    await waitFor(() => expect(result.current.publishedDefinition.failed).toBe(true));
  });

  describe('the thumbnail', () => {
    const draftImage = new Blob(['draft'], { type: 'image/png' });
    const liveImage = new Blob(['live'], { type: 'image/png' });

    it('is not read when no listing has one', async () => {
      api.getMcpProxyApiPortalDraft.mockResolvedValue(DRAFT as never);
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(api.getMcpProxyApiPortalDraftThumbnail).not.toHaveBeenCalled();
      expect(result.current.seed?.thumbnail).toBeUndefined();
      expect(result.current.publishedThumbnail).toBeUndefined();
    });

    it('opens on the draft\'s own, which saving need not send again', async () => {
      api.getMcpProxyApiPortalDraft.mockResolvedValue({ ...DRAFT, hasThumbnail: true } as never);
      api.getMcpProxyApiPortalPublication.mockResolvedValue({ ...PUBLICATION, hasThumbnail: true } as never);
      api.getMcpProxyApiPortalDraftThumbnail.mockResolvedValue(draftImage);
      api.getMcpProxyApiPortalPublicationThumbnail.mockResolvedValue(liveImage);
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.seed?.thumbnail).toEqual({ blob: draftImage, inDraft: true });
      expect(result.current.publishedThumbnail).toBe(liveImage);
    });

    it('falls back to the live listing\'s, which the draft would still have to store', async () => {
      api.getMcpProxyApiPortalPublication.mockResolvedValue({ ...PUBLICATION, hasThumbnail: true } as never);
      api.getMcpProxyApiPortalPublicationThumbnail.mockResolvedValue(liveImage);
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.seed?.thumbnail).toEqual({ blob: liveImage, inDraft: false });
    });

    it('does not fall through to the live one when the draft\'s cannot be read', async () => {
      api.getMcpProxyApiPortalDraft.mockResolvedValue({ ...DRAFT, hasThumbnail: true } as never);
      api.getMcpProxyApiPortalPublication.mockResolvedValue({ ...PUBLICATION, hasThumbnail: true } as never);
      api.getMcpProxyApiPortalDraftThumbnail.mockRejectedValue(serverError());
      api.getMcpProxyApiPortalPublicationThumbnail.mockResolvedValue(liveImage);
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBeUndefined();
      expect(result.current.seed?.thumbnail).toBeUndefined();
    });
  });

  describe('the landing page', () => {
    it('is not read when no listing has one', async () => {
      api.getMcpProxyApiPortalDraft.mockResolvedValue(DRAFT as never);
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(api.getMcpProxyApiPortalDraftLandingPage).not.toHaveBeenCalled();
      expect(result.current.seed?.landingPage).toBeUndefined();
      expect(result.current.seed?.landingPageFailed).toBe(false);
      expect(result.current.publishedLandingPage).toEqual({ failed: false, text: undefined });
    });

    it('opens on the draft\'s own, which saving need not send again', async () => {
      api.getMcpProxyApiPortalDraft.mockResolvedValue({ ...DRAFT, hasLandingPage: true } as never);
      api.getMcpProxyApiPortalPublication.mockResolvedValue({ ...PUBLICATION, hasLandingPage: true } as never);
      api.getMcpProxyApiPortalDraftLandingPage.mockResolvedValue('# Draft');
      api.getMcpProxyApiPortalPublicationLandingPage.mockResolvedValue('# Live');
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.seed?.landingPage).toEqual({ text: '# Draft', inDraft: true });
      expect(result.current.publishedLandingPage).toEqual({ failed: false, text: '# Live' });
    });

    it('falls back to the live listing\'s, which the draft would still have to store', async () => {
      api.getMcpProxyApiPortalPublication.mockResolvedValue({ ...PUBLICATION, hasLandingPage: true } as never);
      api.getMcpProxyApiPortalPublicationLandingPage.mockResolvedValue('# Live');
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.seed?.landingPage).toEqual({ text: '# Live', inDraft: false });
    });

    it('keeps a blank page, which is a page', async () => {
      api.getMcpProxyApiPortalDraft.mockResolvedValue({ ...DRAFT, hasLandingPage: true } as never);
      api.getMcpProxyApiPortalDraftLandingPage.mockResolvedValue('');
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.seed?.landingPage).toEqual({ text: '', inDraft: true });
      expect(result.current.seed?.landingPageFailed).toBe(false);
    });

    it('flags a page that cannot be read instead of falling through to the live one', async () => {
      api.getMcpProxyApiPortalDraft.mockResolvedValue({ ...DRAFT, hasLandingPage: true } as never);
      api.getMcpProxyApiPortalPublication.mockResolvedValue({ ...PUBLICATION, hasLandingPage: true } as never);
      api.getMcpProxyApiPortalDraftLandingPage.mockRejectedValue(serverError());
      api.getMcpProxyApiPortalPublicationLandingPage.mockResolvedValue('# Live');
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBeUndefined();
      expect(result.current.seed?.landingPage).toBeUndefined();
      expect(result.current.seed?.landingPageFailed).toBe(true);
    });

    it('flags a live page that cannot be read', async () => {
      api.getMcpProxyApiPortalPublication.mockResolvedValue({ ...PUBLICATION, hasLandingPage: true } as never);
      api.getMcpProxyApiPortalPublicationLandingPage.mockRejectedValue(serverError());
      const { result } = load();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.publishedLandingPage).toEqual({ failed: true, text: undefined });
    });
  });

  it('reads everything again on refetch', async () => {
    const { result } = load();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getMCPServer).toHaveBeenCalledTimes(1);

    act(() => result.current.refetch());
    await waitFor(() => expect(api.getMCPServer).toHaveBeenCalledTimes(2));
  });

  it('reads nothing until it knows the hub, the proxy and the organization', () => {
    renderHook(() => usePublishPageData('hub', 'travel', '', false));
    expect(api.getMCPServer).not.toHaveBeenCalled();
  });
});
