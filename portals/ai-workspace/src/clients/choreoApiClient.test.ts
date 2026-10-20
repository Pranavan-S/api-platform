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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBlob, getText, putForm, putText } from './choreoApiClient';

vi.mock('../auth/logout', () => ({ handleUnauthorizedResponse: vi.fn() }));
vi.mock('../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const BASE = 'https://platform.test';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastRequest = () => {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: String(url), init: init as RequestInit & { headers: Record<string, string> } };
};

describe('getText and getBlob', () => {
  it('read a non-JSON body from a same-origin credentialed GET', async () => {
    fetchMock.mockResolvedValueOnce(new Response('# Hello'));
    await expect(getText('/draft/landing-page', BASE)).resolves.toBe('# Hello');
    const { url, init } = lastRequest();
    expect(url).toBe(`${BASE}/draft/landing-page`);
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' });

    fetchMock.mockResolvedValueOnce(new Response('png', { headers: { 'Content-Type': 'image/png' } }));
    const blob = await getBlob('/draft/thumbnail', BASE);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(3);
  });

  it('throw the API error a failed response describes', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'DRAFT_NOT_FOUND', message: 'No draft.' }), { status: 404 })
    );
    await expect(getText('/draft/landing-page', BASE)).rejects.toMatchObject({ status: 404, code: 'DRAFT_NOT_FOUND' });
  });

  it('fall back to the status when the failure body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('gateway down', { status: 502 }));
    await expect(getBlob('/draft/thumbnail', BASE)).rejects.toMatchObject({ status: 502, message: 'HTTP 502' });
  });
});

describe('putText', () => {
  it('sends the text as the given content type and resolves with nothing on 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(putText('/draft/landing-page', '# Hi', 'text/markdown', BASE)).resolves.toBeUndefined();
    const { init } = lastRequest();
    expect(init).toMatchObject({ method: 'PUT', body: '# Hi', credentials: 'include' });
    expect(init.headers['Content-Type']).toBe('text/markdown');
  });
});

describe('putForm', () => {
  it('leaves the content type to the browser so the multipart boundary is set', async () => {
    const form = new FormData();
    form.append('file', new Blob(['x']));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(putForm('/draft/thumbnail', form, BASE)).resolves.toBeUndefined();
    const { init } = lastRequest();
    expect(init.body).toBe(form);
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('still returns the JSON a response carries', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ handle: 'db-password' })));
    await expect(putForm('/secrets/db-password', new FormData(), BASE)).resolves.toEqual({ handle: 'db-password' });
  });
});
