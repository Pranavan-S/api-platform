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
import { SCOPES } from '../../../../auth/permissions';
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { renderWithProviders, screen } from '../../../../test/utils';
import ExternalServersOverview from './ExternalServersOverview';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), allowed: new Set<string>(), allowAll: true }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock('../../../../contexts/AppShellContext', () => ({
  useAppShell: () => ({
    currentProject: { id: 'proj-1', displayName: 'Project One' },
    currentOrganization: { id: 'org-1', uuid: 'org-1', handle: 'acme' },
    projectsForCurrentOrganization: [{ id: 'proj-1', displayName: 'Project One' }],
  }),
}));
vi.mock('../../../../contexts/AppAuthContext', () => ({
  useAppAuth: () => ({ hasPermission: (scope: string) => mocks.allowAll || mocks.allowed.has(scope) }),
}));
vi.mock('../../../../hooks/aiWorkspaceSnackbar', () => ({ default: () => vi.fn() }));
vi.mock('../../../../apis/MCP/mcpProxiesApis', () => ({
  mcpProxiesApis: { getMCPServer: vi.fn(), updateMCPServer: vi.fn(), deleteMCPServer: vi.fn() },
}));
vi.mock('../../../../apis/MCP/mcpServerDeployApis', () => ({
  getMCPServerDeployments: vi.fn().mockResolvedValue({ list: [] }),
}));
vi.mock('../../../../apis/MCP/mcpServerValidationApis', () => ({}));
vi.mock('../../../../apis/gatewayApis', () => ({ getGateways: vi.fn().mockResolvedValue({ list: [] }) }));
vi.mock('../../../../apis/policyHubApis', () => ({ getGuardrails: vi.fn().mockResolvedValue([]), getPolicies: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../../apis/secretApis', () => ({
  createSecret: vi.fn(),
  deleteSecret: vi.fn(),
  buildSecretPlaceholder: vi.fn(),
  generateSecretHandle: vi.fn(),
  extractSecretHandle: vi.fn(),
}));
vi.mock('../../../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const SERVER = { id: 'travel mcp', displayName: 'Travel MCP', version: 'v1', context: '/travel', policies: [], upstream: { main: { url: 'https://up.test' } } };

const open = () =>
  renderWithProviders(<ExternalServersOverview />, {
    route: '/projects/proj-1/mcp-proxy/travel%20mcp',
    path: '/projects/:projectSlug/mcp-proxy/:serverId',
  });

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.allowAll = true;
  mocks.allowed = new Set();
  vi.mocked(mcpProxiesApis.getMCPServer).mockReset().mockResolvedValue(SERVER as never);
});

describe('the Publish to MCP Hub button', () => {
  it('opens the proxy\'s hub list, within its project', async () => {
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: 'Publish to MCP Hub' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/organizations/acme/projects/proj-1/publish/travel%20mcp');
  });

  it('is off for a user who may neither publish nor unpublish', async () => {
    mocks.allowAll = false;
    open();
    expect(await screen.findByRole('button', { name: 'Publish to MCP Hub' })).toBeDisabled();
  });

  it('stays on for a user who may only unpublish', async () => {
    mocks.allowAll = false;
    mocks.allowed = new Set([SCOPES.MCP_PROXY_API_PORTAL_UNPUBLISH]);
    open();
    expect(await screen.findByRole('button', { name: 'Publish to MCP Hub' })).toBeEnabled();
  });
});
