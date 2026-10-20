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
import { listSubscriptionPlans } from '../apis/subscriptionPlanApis';
import { useSubscriptionPlans } from './useSubscriptionPlans';

vi.mock('../apis/subscriptionPlanApis', () => ({ listSubscriptionPlans: vi.fn() }));
vi.mock('../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const list = vi.mocked(listSubscriptionPlans);
const gold = { id: 'gold', displayName: 'Gold', status: 'ACTIVE' as const };

beforeEach(() => {
  list.mockReset();
});

describe('useSubscriptionPlans', () => {
  it('reads nothing until enabled', () => {
    renderHook(() => useSubscriptionPlans(false));
    expect(list).not.toHaveBeenCalled();
  });

  it('loads the plans once enabled', async () => {
    list.mockResolvedValue([gold]);
    const { result } = renderHook(() => useSubscriptionPlans(true));
    expect(result.current.plans).toBeUndefined();
    await waitFor(() => expect(result.current.plans).toEqual([gold]));
    expect(result.current.failed).toBe(false);
  });

  it('says so when the read fails', async () => {
    list.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSubscriptionPlans(true));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.plans).toBeUndefined();
  });
});
