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

import type { Gateway } from '@/api/resources/gateways';
import { buildInvokeUrl } from '../../apis/overview/InvokeUrlPanel';

/** A URL consumers can call the API on, and the gateway that serves it. */
export type GatewayUrlOption = { gatewayName: string; url: string };

/**
 * One option per address of each gateway, in the order given: the gateway's
 * address plus the API's context, the same URL the Overview tab shows. A URL
 * two gateways share is offered once, under the first.
 */
export const gatewayUrlOptions = (gateways: readonly Gateway[], context?: string): GatewayUrlOption[] => {
  const options = new Map<string, GatewayUrlOption>();
  gateways.forEach((gateway) =>
    (gateway.endpoints ?? []).forEach((endpoint) => {
      const url = buildInvokeUrl(endpoint, context);
      if (url !== '' && !options.has(url)) {
        options.set(url, { gatewayName: gateway.displayName || gateway.id || '', url });
      }
    }),
  );
  return [...options.values()];
};
