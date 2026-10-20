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
import { renderWithProviders, screen, within } from '../../../../test/utils';
import type { MCPProxyDocument } from '../../../../utils/types';
import { DocumentsTab } from './DocumentsTab';
import { emptyDraftFormValues, type DraftFormValues } from './mcpPublishForm';

vi.mock('../../../../apis/MCP/mcpProxiesApis', () => ({ mcpProxiesApis: { getMcpProxyDocumentContent: vi.fn() } }));
vi.mock('../../../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const content = vi.mocked(mcpProxiesApis.getMcpProxyDocumentContent);

const documents: MCPProxyDocument[] = [
  { id: 'quickstart', type: 'HowTo', displayName: 'Quickstart' },
  { id: 'sdk', type: 'Samples', displayName: 'Client SDK' },
  { id: 'faq', type: 'Frequently asked', displayName: 'FAQ' },
];

const withDocs = (docIds: string[]): DraftFormValues => ({ ...emptyDraftFormValues, docIds });

beforeEach(() => {
  content.mockReset();
});

describe('DocumentsTab', () => {
  it('waits for the documents, and says when they could not be read', () => {
    const { unmount } = renderWithProviders(<DocumentsTab mcpProxyId="travel" values={withDocs([])} />);
    expect(screen.getByText('Loading documents')).toBeInTheDocument();
    unmount();
    renderWithProviders(<DocumentsTab failed mcpProxyId="travel" values={withDocs([])} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load documents.');
  });

  it('explains an empty list', () => {
    renderWithProviders(<DocumentsTab documents={[]} mcpProxyId="travel" values={withDocs([])} />);
    expect(screen.getByText('No documents')).toBeInTheDocument();
    expect(screen.getByText('This MCP proxy has no documents to choose from.')).toBeInTheDocument();
  });

  it('lists every document with its type, ticking the selected ones', () => {
    renderWithProviders(<DocumentsTab documents={documents} mcpProxyId="travel" values={withDocs(['sdk'])} />);
    expect(screen.getByRole('checkbox', { name: 'Quickstart' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Client SDK' })).toBeChecked();
    expect(screen.getByText('How To')).toBeInTheDocument();
    expect(screen.getByText('Samples & SDK')).toBeInTheDocument();
    // A custom type is shown as typed.
    expect(screen.getByText('Frequently asked')).toBeInTheDocument();
    expect(screen.getByText('of 3 documents selected', { exact: false })).toBeInTheDocument();
  });

  it('adds and removes a document from the selection', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <DocumentsTab documents={documents} mcpProxyId="travel" onChange={onChange} values={withDocs(['sdk'])} />
    );
    await user.click(screen.getByRole('checkbox', { name: 'Quickstart' }));
    expect(onChange).toHaveBeenLastCalledWith(withDocs(['sdk', 'quickstart']));
    await user.click(screen.getByRole('checkbox', { name: 'Client SDK' }));
    expect(onChange).toHaveBeenLastCalledWith(withDocs([]));
  });

  it('selects every document, or clears them once all are selected', async () => {
    const onChange = vi.fn();
    const { user, rerender } = renderWithProviders(
      <DocumentsTab documents={documents} mcpProxyId="travel" onChange={onChange} values={withDocs(['sdk'])} />
    );
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onChange).toHaveBeenLastCalledWith(withDocs(['quickstart', 'sdk', 'faq']));

    rerender(
      <DocumentsTab
        documents={documents}
        mcpProxyId="travel"
        onChange={onChange}
        values={withDocs(['quickstart', 'sdk', 'faq'])}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenLastCalledWith(withDocs([]));
  });

  it('locks the controls while an action runs', () => {
    renderWithProviders(<DocumentsTab disabled documents={documents} mcpProxyId="travel" values={withDocs([])} />);
    expect(screen.getByRole('checkbox', { name: 'Quickstart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled();
  });

  it('previews a document and adds it from the preview', async () => {
    content.mockResolvedValue({ contentType: 'text/markdown', text: '# Getting started' });
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <DocumentsTab documents={documents} mcpProxyId="travel" onChange={onChange} values={withDocs([])} />
    );
    await user.click(screen.getByRole('button', { name: 'Preview Quickstart' }));
    const drawer = await screen.findByRole('presentation');
    expect(await within(drawer).findByRole('heading', { name: 'Getting started' })).toBeInTheDocument();
    expect(content).toHaveBeenCalledWith('travel', 'quickstart', expect.any(String));

    await user.click(within(drawer).getByRole('button', { name: 'Add to listing' }));
    expect(onChange).toHaveBeenLastCalledWith(withDocs(['quickstart']));
  });

  it('offers to remove a document that is already selected from its preview', async () => {
    content.mockResolvedValue({ contentType: 'text/markdown', text: 'Hi' });
    const { user } = renderWithProviders(
      <DocumentsTab documents={documents} mcpProxyId="travel" values={withDocs(['sdk'])} />
    );
    await user.click(screen.getByRole('button', { name: 'Preview Client SDK' }));
    expect(await screen.findByRole('button', { name: 'Remove from listing' })).toBeInTheDocument();
  });

  describe('read-only', () => {
    it('lists only the documents the live listing holds, with no controls', () => {
      renderWithProviders(<DocumentsTab documents={documents} mcpProxyId="travel" readOnly values={withDocs(['sdk'])} />);
      expect(screen.getByText('Client SDK')).toBeInTheDocument();
      expect(screen.queryByText('Quickstart')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Preview/ })).not.toBeInTheDocument();
      expect(screen.getByText('document published', { exact: false })).toBeInTheDocument();
    });

    it('says so when the listing has no documents', () => {
      renderWithProviders(<DocumentsTab documents={documents} mcpProxyId="travel" readOnly values={withDocs([])} />);
      expect(screen.getByText('This listing has no documents.')).toBeInTheDocument();
    });
  });
});
