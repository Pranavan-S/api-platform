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
import { get, getBlob, getText, post, put, putForm, putText } from '../../clients/choreoApiClient';
import {
  deprecateMcpProxyOnApiPortal,
  getMcpProxyApiPortalDraftDefinition,
  getMcpProxyApiPortalDraftLandingPage,
  getMcpProxyApiPortalDraftThumbnail,
  getMcpProxyApiPortalPublicationDefinition,
  getMcpProxyApiPortalPublicationLandingPage,
  getMcpProxyApiPortalPublicationThumbnail,
  getMcpProxyDocumentContent,
  listMcpProxyApiPortalPublications,
  listMcpProxyDocuments,
  publishSavedMcpProxyDraft,
  saveMcpProxyApiPortalDraft,
  saveMcpProxyApiPortalDraftDefinition,
  saveMcpProxyApiPortalDraftLandingPage,
  saveMcpProxyApiPortalDraftThumbnail,
  unpublishMcpProxyFromApiPortal,
} from './mcpProxiesApis';

vi.mock('../../clients/choreoApiClient', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  getBlob: vi.fn(),
  getText: vi.fn(),
  putForm: vi.fn(),
  putText: vi.fn(),
}));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const BASE = 'https://platform.test';
const ROOT = '/api-portals/hub%2F1/apis/mcp-proxy/server%201';

beforeEach(() => {
  vi.mocked(get).mockReset();
  vi.mocked(post).mockReset();
  vi.mocked(put).mockReset();
  vi.mocked(getBlob).mockReset();
  vi.mocked(getText).mockReset();
  vi.mocked(putForm).mockReset();
  vi.mocked(putText).mockReset();
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

describe('MCP proxy landing page and thumbnail calls', () => {
  it('reads the draft and live landing pages as text', async () => {
    vi.mocked(getText).mockResolvedValue('# Travel');
    await expect(getMcpProxyApiPortalDraftLandingPage('hub/1', 'server 1', BASE)).resolves.toBe('# Travel');
    await getMcpProxyApiPortalPublicationLandingPage('hub/1', 'server 1', BASE);
    expect(getText).toHaveBeenNthCalledWith(1, `${ROOT}/draft/landing-page`, BASE);
    expect(getText).toHaveBeenNthCalledWith(2, `${ROOT}/publication/landing-page`, BASE);
  });

  it('saves the landing page as Markdown', async () => {
    await saveMcpProxyApiPortalDraftLandingPage('hub/1', 'server 1', '# Travel', BASE);
    expect(putText).toHaveBeenCalledWith(`${ROOT}/draft/landing-page`, '# Travel', 'text/markdown', BASE);
  });

  it('reads the draft and live thumbnails as images', async () => {
    const image = new Blob(['png'], { type: 'image/png' });
    vi.mocked(getBlob).mockResolvedValue(image);
    await expect(getMcpProxyApiPortalDraftThumbnail('hub/1', 'server 1', BASE)).resolves.toBe(image);
    await getMcpProxyApiPortalPublicationThumbnail('hub/1', 'server 1', BASE);
    expect(getBlob).toHaveBeenNthCalledWith(1, `${ROOT}/draft/thumbnail`, BASE);
    expect(getBlob).toHaveBeenNthCalledWith(2, `${ROOT}/publication/thumbnail`, BASE);
  });

  it('uploads the thumbnail as the multipart `file` field', async () => {
    const image = new Blob(['png'], { type: 'image/png' });
    await saveMcpProxyApiPortalDraftThumbnail('hub/1', 'server 1', image, BASE);
    const [path, form, base] = vi.mocked(putForm).mock.calls[0];
    expect(path).toBe(`${ROOT}/draft/thumbnail`);
    expect((form as FormData).get('file')).toBeInstanceOf(Blob);
    expect(base).toBe(BASE);
  });
});

describe('MCP proxy document calls', () => {
  const DOCS = '/apis/mcp-proxy/server%201/docs';
  const doc = (id: string) => ({ id, type: 'DOC_Other', displayName: id });

  it('lists every document, paging until the total is held', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce({ list: [doc('a'), doc('b')], pagination: { total: 3, offset: 0, limit: 100 } })
      .mockResolvedValueOnce({ list: [doc('c')], pagination: { total: 3, offset: 2, limit: 100 } });
    const documents = await listMcpProxyDocuments('server 1', BASE);
    expect(documents.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(get).toHaveBeenNthCalledWith(1, DOCS, { limit: 100, offset: 0 }, BASE);
    expect(get).toHaveBeenNthCalledWith(2, DOCS, { limit: 100, offset: 2 }, BASE);
  });

  it('stops on an empty page even when the total says more', async () => {
    vi.mocked(get).mockResolvedValueOnce({ list: [], pagination: { total: 5, offset: 0, limit: 100 } });
    await expect(listMcpProxyDocuments('server 1', BASE)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reads one document body with its content type', async () => {
    vi.mocked(getBlob).mockResolvedValue({ type: 'text/markdown', text: async () => '# Guide' } as Blob);
    await expect(getMcpProxyDocumentContent('server 1', 'how to', BASE)).resolves.toEqual({
      contentType: 'text/markdown',
      text: '# Guide',
    });
    expect(getBlob).toHaveBeenCalledWith(`${DOCS}/how%20to/content`, BASE);
  });
});
