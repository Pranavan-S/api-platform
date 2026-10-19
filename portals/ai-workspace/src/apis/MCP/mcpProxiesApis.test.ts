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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get, post, put } from '../../clients/choreoApiClient';
import {
  deprecateMcpProxyOnApiPortal,
  getMcpProxyApiPortalDraftDefinition,
  getMcpProxyApiPortalPublicationDefinition,
  listMcpProxyApiPortalPublications,
  publishSavedMcpProxyDraft,
  saveMcpProxyApiPortalDraft,
  saveMcpProxyApiPortalDraftDefinition,
  unpublishMcpProxyFromApiPortal,
} from './mcpProxiesApis';

vi.mock('../../clients/choreoApiClient', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const BASE = 'https://platform.test';
const ROOT = '/api-portals/hub%2F1/apis/mcp-proxy/server%201';

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(post).mockReset();
  vi.mocked(put).mockReset();
});

describe('MCP proxy API portal publication calls', () => {
  it('lists the portals with this proxy\'s status on each', async () => {
    vi.mocked(get).mockResolvedValue({ list: [] });
    await listMcpProxyApiPortalPublications('server-1', BASE);
    expect(get).toHaveBeenCalledWith('/api-publications', { apiType: 'mcp-proxy', apiId: 'server-1', limit: 100 }, BASE);
  });

  it('saves the draft by replacing it', async () => {
    const draft = { displayName: 'Travel', version: '1' };
    await saveMcpProxyApiPortalDraft('hub/1', 'server 1', draft, BASE);
    expect(put).toHaveBeenCalledWith(`${ROOT}/draft`, draft, BASE);
  });

  it('stores the definition on the draft', async () => {
    await saveMcpProxyApiPortalDraftDefinition('hub/1', 'server 1', { tools: [] }, BASE);
    expect(put).toHaveBeenCalledWith(`${ROOT}/draft/definition`, { tools: [] }, BASE);
  });

  it.each([
    ['publish', publishSavedMcpProxyDraft, '/publish'],
    ['deprecate', deprecateMcpProxyOnApiPortal, '/deprecate'],
  ])('posts %s without a body', async (_name, call, suffix) => {
    await call('hub/1', 'server 1', BASE);
    expect(post).toHaveBeenCalledWith(`${ROOT}${suffix}`, undefined, BASE);
  });

  it('unpublishes without a body', async () => {
    await unpublishMcpProxyFromApiPortal('hub/1', 'server 1', BASE);
    expect(post).toHaveBeenCalledWith(`${ROOT}/unpublish`, undefined, BASE);
  });

  it('reads the draft and the live definitions from their own paths', async () => {
    await getMcpProxyApiPortalDraftDefinition('hub/1', 'server 1', BASE);
    await getMcpProxyApiPortalPublicationDefinition('hub/1', 'server 1', BASE);
    expect(get).toHaveBeenNthCalledWith(1, `${ROOT}/draft/definition`, undefined, BASE);
    expect(get).toHaveBeenNthCalledWith(2, `${ROOT}/publication/definition`, undefined, BASE);
  });
});
