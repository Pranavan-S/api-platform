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

import { describe, expect, it } from 'vitest';

import { aGateway } from '@/test/msw';
import { gatewayUrlOptions } from './gatewayUrlOptions';

describe('gatewayUrlOptions', () => {
  it('builds one option per gateway address from the address and the API context, in order', () => {
    const gateways = [
      aGateway({ displayName: 'Gateway A', endpoints: ['https://a.example.com/', 'b.example.com'] }),
      aGateway({ displayName: '', endpoints: ['https://c.example.com'], id: 'gw-c' }),
    ];

    expect(gatewayUrlOptions(gateways, '/loans')).toEqual([
      { gatewayName: 'Gateway A', url: 'https://a.example.com/loans' },
      { gatewayName: 'Gateway A', url: 'https://b.example.com/loans' },
      { gatewayName: 'gw-c', url: 'https://c.example.com/loans' },
    ]);
  });

  it('offers a URL shared by two gateways once, and skips a gateway with no address', () => {
    const gateways = [
      aGateway({ displayName: 'First', endpoints: ['https://gw.example.com'] }),
      aGateway({ displayName: 'Second', endpoints: ['https://gw.example.com', ' '] }),
      aGateway({ endpoints: undefined }),
    ];

    expect(gatewayUrlOptions(gateways, '/loans')).toEqual([{ gatewayName: 'First', url: 'https://gw.example.com/loans' }]);
  });

  it('offers nothing when there are no gateways', () => {
    expect(gatewayUrlOptions([], '/loans')).toEqual([]);
  });
});
