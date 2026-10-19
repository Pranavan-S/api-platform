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

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getGateways } from '../apis/gatewayApis';
import { getMCPServerDeployments } from '../apis/MCP/mcpServerDeployApis';
import { useMcpDeployedGateways } from './useMcpDeployedGateways';

vi.mock('../apis/gatewayApis', () => ({ getGateways: vi.fn() }));
vi.mock('../apis/MCP/mcpServerDeployApis', () => ({ getMCPServerDeployments: vi.fn() }));
vi.mock('../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const gateway = (id: string) => ({ id, name: id });
const deployment = (gatewayId: string, createdAt: string, status = 'DEPLOYED') => ({ gatewayId, createdAt, status });

beforeEach(() => {
  vi.mocked(getGateways).mockReset();
  vi.mocked(getMCPServerDeployments).mockReset();
});

describe('useMcpDeployedGateways', () => {
  it('lists only gateways with a live deployment, newest deployment first', async () => {
    vi.mocked(getGateways).mockResolvedValue({ list: [gateway('a'), gateway('b'), gateway('c')] } as never);
    vi.mocked(getMCPServerDeployments).mockImplementation(async (_id, _base, gatewayId) => {
      const byGateway: Record<string, unknown[]> = {
        a: [deployment('a', '2026-01-01T00:00:00Z')],
        b: [deployment('b', '2026-03-01T00:00:00Z'), deployment('b', '2026-04-01T00:00:00Z', 'UNDEPLOYED')],
        c: [deployment('c', '2026-02-01T00:00:00Z', 'UNDEPLOYED')],
      };
      return { list: byGateway[gatewayId as string] } as never;
    });

    const { result } = renderHook(() => useMcpDeployedGateways('org', 'proxy'));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.gateways.map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('treats a gateway whose deployments cannot be read as having none', async () => {
    vi.mocked(getGateways).mockResolvedValue({ list: [gateway('a'), gateway('b')] } as never);
    vi.mocked(getMCPServerDeployments).mockImplementation(async (_id, _base, gatewayId) => {
      if (gatewayId === 'a') throw new Error('boom');
      return { list: [deployment('b', '2026-01-01T00:00:00Z')] } as never;
    });

    const { result } = renderHook(() => useMcpDeployedGateways('org', 'proxy'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.gateways.map((g) => g.id)).toEqual(['b']);
  });

  it('settles with no gateways when the gateway list itself cannot be read', async () => {
    vi.mocked(getGateways).mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useMcpDeployedGateways('org', 'proxy'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.gateways).toEqual([]);
  });

  it('reads nothing until it knows the organization and the proxy', async () => {
    const { result } = renderHook(() => useMcpDeployedGateways('', 'proxy'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getGateways).not.toHaveBeenCalled();
    expect(result.current.gateways).toEqual([]);
  });
});
