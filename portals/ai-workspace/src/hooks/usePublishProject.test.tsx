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

import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { usePublishProject } from './usePublishProject';

const shell = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('../contexts/AppShellContext', () => ({ useAppShell: () => shell.current }));

const ORG = { uuid: 'org-uuid', handle: 'acme' };
const ALPHA = { id: 'alpha', displayName: 'Alpha' };
const BETA = { id: 'beta', displayName: 'Beta' };

const renderAt = (route: string, projectScoped = true) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route element={<>{children}</>} path={projectScoped ? '/:projectSlug/*' : '*'} />
      </Routes>
    </MemoryRouter>
  );
  return renderHook(() => usePublishProject(), { wrapper }).result.current;
};

describe('usePublishProject', () => {
  it('builds paths in the project named by the route, over the current one', () => {
    shell.current = { currentOrganization: ORG, currentProject: ALPHA, projectsForCurrentOrganization: [ALPHA, BETA] };
    const { organizationId, overviewPath, publishPath } = renderAt('/beta/publish');

    expect(organizationId).toBe('org-uuid');
    expect(publishPath()).toBe('/organizations/acme/projects/beta/publish');
    expect(publishPath('/server-1')).toBe('/organizations/acme/projects/beta/publish/server-1');
    expect(overviewPath('a b')).toBe('/organizations/acme/projects/beta/mcp-proxy/a%20b');
  });

  it('falls back to the current project when the route names none the user can see', () => {
    shell.current = { currentOrganization: ORG, currentProject: ALPHA, projectsForCurrentOrganization: [ALPHA] };
    expect(renderAt('/unknown/publish').publishPath()).toBe('/organizations/acme/projects/alpha/publish');
  });

  it('stays at organization level when there is no project at all', () => {
    shell.current = { currentOrganization: ORG, currentProject: null, projectsForCurrentOrganization: [] };
    expect(renderAt('/x', false).publishPath('/s')).toBe('/organizations/acme/publish/s');
  });

  it('has no organization id before one is loaded', () => {
    shell.current = { currentOrganization: null, currentProject: null, projectsForCurrentOrganization: [] };
    expect(renderAt('/x', false).organizationId).toBe('');
  });
});
