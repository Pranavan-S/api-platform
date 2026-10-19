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
import { renderWithProviders, screen, waitFor } from '../../../../test/utils';
import McpPublishHubs from './McpPublishHubs';

vi.mock('../../../../apis/MCP/mcpProxiesApis', () => ({
  mcpProxiesApis: { getMCPServer: vi.fn(), listMcpProxyApiPortalPublications: vi.fn() },
}));
vi.mock('../../../../hooks/usePublishProject', () => ({
  usePublishProject: () => ({
    currentOrganization: { handle: 'acme' },
    organizationId: 'org-1',
    overviewPath: (id: string) => `/mcp-proxy/${id}`,
    publishPath: (suffix = '') => `/publish${suffix}`,
  }),
}));
vi.mock('../../../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const hub = (id: string, name: string, status: string, extra = {}) => ({
  apiPortalId: id,
  apiPortalName: name,
  apiPortalDescription: `${name} description`,
  apiPortalUrl: `https://${id}.example.com`,
  status,
  ...extra,
});

const HUBS = [hub('one', 'Alpha Hub', 'PUBLISHED'), hub('two', 'Beta Hub', 'NOT_PUBLISHED'), hub('three', 'Gamma Hub', 'DEPRECATED')];

const httpError = (status: number) => Object.assign(new Error('failed'), { status });

const open = () =>
  renderWithProviders(<McpPublishHubs />, { route: '/publish/travel', path: '/publish/:serverId' });

beforeEach(() => {
  vi.mocked(mcpProxiesApis.getMCPServer).mockReset().mockResolvedValue({ id: 'travel', displayName: 'Travel MCP' } as never);
  vi.mocked(mcpProxiesApis.listMcpProxyApiPortalPublications)
    .mockReset()
    .mockResolvedValue({ list: HUBS, pagination: {} } as never);
});

describe('McpPublishHubs', () => {
  it('lists every hub with this proxy\'s status, and counts those it is published to', async () => {
    open();
    expect(await screen.findByText('Alpha Hub')).toBeInTheDocument();
    expect(screen.getByText('Beta Hub')).toBeInTheDocument();
    expect(screen.getByText('Gamma Hub')).toBeInTheDocument();
    expect(screen.getByText('Publish Travel MCP')).toBeInTheDocument();
    expect(screen.getByText('Published to 1 of 3 MCP Hubs')).toBeInTheDocument();
    expect(mcpProxiesApis.listMcpProxyApiPortalPublications).toHaveBeenCalledWith('travel', expect.any(String));
  });

  it('says MCP Hub in the singular for a single hub', async () => {
    vi.mocked(mcpProxiesApis.listMcpProxyApiPortalPublications).mockResolvedValue({
      list: [hub('one', 'Alpha Hub', 'NOT_PUBLISHED')],
      pagination: {},
    } as never);
    open();
    expect(await screen.findByText('Published to 0 of 1 MCP Hub')).toBeInTheDocument();
  });

  it('leads each hub to its own publish page', async () => {
    open();
    await screen.findByText('Alpha Hub');
    const links = screen.getAllByRole('link', { name: 'Go to publish' });
    expect(links[1]).toHaveAttribute('href', '/publish/travel/portals/two');
  });

  it('goes back to the MCP proxy', async () => {
    open();
    await screen.findByText('Alpha Hub');
    expect(screen.getByRole('link', { name: /Back to MCP Proxy/ })).toHaveAttribute('href', '/mcp-proxy/travel');
  });

  it('narrows the hubs by what is typed, and says when none match', async () => {
    const { user } = open();
    await screen.findByText('Alpha Hub');
    const search = screen.getByPlaceholderText('Search MCP Hubs');

    await user.type(search, 'beta');
    expect(screen.queryByText('Alpha Hub')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Hub')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('No matching MCP Hubs')).toBeInTheDocument();
  });

  it('says so when the organization has no hubs', async () => {
    vi.mocked(mcpProxiesApis.listMcpProxyApiPortalPublications).mockResolvedValue({ list: [], pagination: {} } as never);
    open();
    expect(await screen.findByText('No MCP Hubs Available')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search MCP Hubs')).not.toBeInTheDocument();
  });

  it('tells a user without access that they lack permission', async () => {
    vi.mocked(mcpProxiesApis.listMcpProxyApiPortalPublications).mockRejectedValue(httpError(403));
    open();
    expect(await screen.findByText('You don’t have permission')).toBeInTheDocument();
  });

  it('shows any other failure with a way to retry', async () => {
    vi.mocked(mcpProxiesApis.listMcpProxyApiPortalPublications).mockRejectedValueOnce(httpError(500));
    const { user } = open();
    const retry = await screen.findByRole('button', { name: 'Retry' });

    await user.click(retry);
    expect(await screen.findByText('Alpha Hub')).toBeInTheDocument();
    await waitFor(() => expect(mcpProxiesApis.listMcpProxyApiPortalPublications).toHaveBeenCalledTimes(2));
  });
});
