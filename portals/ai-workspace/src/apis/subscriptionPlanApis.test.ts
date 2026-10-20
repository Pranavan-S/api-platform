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
import { get } from '../clients/choreoApiClient';
import { listSubscriptionPlans } from './subscriptionPlanApis';

vi.mock('../clients/choreoApiClient', () => ({ get: vi.fn() }));

const BASE = 'https://platform.test';
const plan = (id: string) => ({ id, displayName: id, status: 'ACTIVE' });

beforeEach(() => {
  vi.mocked(get).mockReset();
});

describe('listSubscriptionPlans', () => {
  it('pages through the plans until the total is held', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce({ list: [plan('gold'), plan('silver')], pagination: { total: 3, offset: 0, limit: 100 } })
      .mockResolvedValueOnce({ list: [plan('bronze')], pagination: { total: 3, offset: 2, limit: 100 } });
    const plans = await listSubscriptionPlans(BASE);
    expect(plans.map((p) => p.id)).toEqual(['gold', 'silver', 'bronze']);
    expect(get).toHaveBeenNthCalledWith(1, '/subscription-plans', { limit: 100, offset: 0 }, BASE);
    expect(get).toHaveBeenNthCalledWith(2, '/subscription-plans', { limit: 100, offset: 2 }, BASE);
  });

  it('stops on an empty page even when the total says more', async () => {
    vi.mocked(get).mockResolvedValueOnce({ list: [], pagination: { total: 5, offset: 0, limit: 100 } });
    await expect(listSubscriptionPlans(BASE)).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
