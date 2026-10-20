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
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { renderWithProviders, screen } from '../../../../test/utils';
import { DocumentPreview } from './DocumentPreview';

vi.mock('../../../../apis/MCP/mcpProxiesApis', () => ({ mcpProxiesApis: { getMcpProxyDocumentContent: vi.fn() } }));
vi.mock('../../../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const content = vi.mocked(mcpProxiesApis.getMcpProxyDocumentContent);

beforeEach(() => {
  content.mockReset();
});

describe('DocumentPreview', () => {
  it('renders Markdown content', async () => {
    content.mockResolvedValue({ contentType: 'text/markdown; charset=utf-8', text: '# Guide\n\nRead on.' });
    renderWithProviders(<DocumentPreview docId="guide" mcpProxyId="travel" />);
    expect(screen.getByText('Loading content')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Guide' })).toBeInTheDocument();
  });

  it('shows plain text and an untyped (empty) body as readable content', async () => {
    content.mockResolvedValue({ contentType: '', text: '' });
    renderWithProviders(<DocumentPreview docId="guide" mcpProxyId="travel" />);
    expect(await screen.findByText('This document has no content.')).toBeInTheDocument();
  });

  it('does not render a format it cannot preview', async () => {
    content.mockResolvedValue({ contentType: 'application/pdf', text: '%PDF-1.7' });
    renderWithProviders(<DocumentPreview docId="guide" mcpProxyId="travel" />);
    expect(await screen.findByText('This document’s format can’t be previewed here.')).toBeInTheDocument();
    expect(screen.queryByText('%PDF-1.7')).not.toBeInTheDocument();
  });

  it('says so when the content could not be read', async () => {
    content.mockRejectedValue(new Error('boom'));
    renderWithProviders(<DocumentPreview docId="guide" mcpProxyId="travel" />);
    expect(await screen.findByText('Unable to load the content of this document.')).toBeInTheDocument();
  });
});
