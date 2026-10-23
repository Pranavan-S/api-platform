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
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { get, post, put } from '../../clients/choreoApiClient';
import {
  deprecateMcpProxyOnApiPortal,
  getMcpProxyApiPortalDraftDefinition,
  getMcpProxyApiPortalPublicationDefinition,
  listMcpProxyApiPortalPublications,
  mcpProxiesApis,
  publishSavedMcpProxyDraft,
  saveMcpProxyApiPortalDraft,
  saveMcpProxyApiPortalDraftDefinition,
} from './mcpProxiesApis';

vi.mock('../../clients/choreoApiClient', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const BASE = 'https://control-plane.test';
const HUB = 'hub/one';
const PROXY = 'travel mcp';
const PORTAL_PATH = '/api-portals/hub%2Fone/apis/mcp-proxy/travel%20mcp';

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(post).mockReset();
  vi.mocked(put).mockReset();
});

describe('listMcpProxyApiPortalPublications', () => {
  it('asks for this MCP proxy across every portal, as one page of up to 100', async () => {
    const summary = { list: [], pagination: { total: 0, offset: 0, limit: 100 } };
    vi.mocked(get).mockResolvedValue(summary);

    const result = await listMcpProxyApiPortalPublications(PROXY, BASE);

    expect(get).toHaveBeenCalledWith(
      '/api-publications',
      { apiType: 'mcp-proxy', apiId: PROXY, limit: 100 },
      BASE
    );
    expect(result).toBe(summary);
  });

  it('propagates a failed read rather than reporting no portals', async () => {
    vi.mocked(get).mockRejectedValue(new Error('forbidden'));

    await expect(listMcpProxyApiPortalPublications(PROXY, BASE)).rejects.toThrow('forbidden');
  });
});

describe('saveMcpProxyApiPortalDraft', () => {
  it('replaces the draft with the given details and returns what was stored', async () => {
    const draft = { displayName: 'Travel', version: '1.0', subscriptionPlanIds: [], docIds: [] };
    const stored = { ...draft, hasThumbnail: false };
    vi.mocked(put).mockResolvedValue(stored);

    const result = await saveMcpProxyApiPortalDraft(HUB, PROXY, draft, BASE);

    expect(put).toHaveBeenCalledWith(`${PORTAL_PATH}/draft`, draft, BASE);
    expect(result).toBe(stored);
  });
});

describe('the draft definition', () => {
  it('is saved to the draft, as the object it is', async () => {
    vi.mocked(put).mockResolvedValue(undefined);
    const definition = { tools: [{ name: 'search' }], resources: [], prompts: [] };

    await saveMcpProxyApiPortalDraftDefinition(HUB, PROXY, definition, BASE);

    expect(put).toHaveBeenCalledWith(`${PORTAL_PATH}/draft/definition`, definition, BASE);
  });

  it('is read from the draft', async () => {
    const definition = { tools: [], resources: [], prompts: [] };
    vi.mocked(get).mockResolvedValue(definition);

    expect(await getMcpProxyApiPortalDraftDefinition(HUB, PROXY, BASE)).toBe(definition);
    expect(get).toHaveBeenCalledWith(`${PORTAL_PATH}/draft/definition`, undefined, BASE);
  });

  it('is read from the live listing', async () => {
    const definition = { tools: [{ name: 'live' }] };
    vi.mocked(get).mockResolvedValue(definition);

    expect(await getMcpProxyApiPortalPublicationDefinition(HUB, PROXY, BASE)).toBe(definition);
    expect(get).toHaveBeenCalledWith(`${PORTAL_PATH}/publication/definition`, undefined, BASE);
  });

  it('lets a missing definition surface as the error, for the caller to read as "none saved"', async () => {
    const notFound = Object.assign(new Error('not found'), { status: 404 });
    vi.mocked(get).mockRejectedValue(notFound);

    await expect(getMcpProxyApiPortalDraftDefinition(HUB, PROXY, BASE)).rejects.toBe(notFound);
  });
});

describe('publishSavedMcpProxyDraft', () => {
  it('publishes with no body, since the server publishes what the draft holds', async () => {
    const publication = { apiPortalId: HUB, status: 'PUBLISHED' };
    vi.mocked(post).mockResolvedValue(publication);

    const result = await publishSavedMcpProxyDraft(HUB, PROXY, BASE);

    expect(post).toHaveBeenCalledWith(`${PORTAL_PATH}/publish`, undefined, BASE);
    expect(result).toBe(publication);
  });
});

describe('deprecateMcpProxyOnApiPortal', () => {
  it('deprecates with no body and returns the updated listing', async () => {
    const publication = { apiPortalId: HUB, status: 'DEPRECATED' };
    vi.mocked(post).mockResolvedValue(publication);

    const result = await deprecateMcpProxyOnApiPortal(HUB, PROXY, BASE);

    expect(post).toHaveBeenCalledWith(`${PORTAL_PATH}/deprecate`, undefined, BASE);
    expect(result).toBe(publication);
  });
});

describe('mcpProxiesApis', () => {
  it('exposes the existing publishing calls alongside the new ones', () => {
    expect(mcpProxiesApis).toMatchObject({
      getMcpProxyApiPortalPublication: expect.any(Function),
      getMcpProxyApiPortalDraft: expect.any(Function),
      publishMcpProxyToApiPortal: expect.any(Function),
      unpublishMcpProxyFromApiPortal: expect.any(Function),
      listMcpProxyApiPortalPublications: expect.any(Function),
      saveMcpProxyApiPortalDraft: expect.any(Function),
      saveMcpProxyApiPortalDraftDefinition: expect.any(Function),
      getMcpProxyApiPortalDraftDefinition: expect.any(Function),
      getMcpProxyApiPortalPublicationDefinition: expect.any(Function),
      publishSavedMcpProxyDraft: expect.any(Function),
      deprecateMcpProxyOnApiPortal: expect.any(Function),
    });
  });
});
