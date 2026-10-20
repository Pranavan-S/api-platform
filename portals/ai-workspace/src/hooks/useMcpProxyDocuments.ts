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

import { useEffect, useState } from 'react';
import { mcpProxiesApis } from '../apis/MCP/mcpProxiesApis';
import { PLATFORM_API_BASE_URL } from '../paths';
import { logger } from '../utils/logger';
import type { MCPProxyDocument } from '../utils/types';

/**
 * Every document of an MCP proxy, read once `enabled` is set. `documents` is
 * `undefined` until they are in; a failed read sets `failed` instead.
 */
export function useMcpProxyDocuments(
  mcpProxyId: string,
  enabled: boolean
): { documents?: MCPProxyDocument[]; failed: boolean } {
  const [documents, setDocuments] = useState<MCPProxyDocument[]>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !mcpProxyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await mcpProxiesApis.listMcpProxyDocuments(mcpProxyId, PLATFORM_API_BASE_URL);
        if (cancelled) return;
        setDocuments(list);
        setFailed(false);
      } catch (error) {
        logger.error('Failed to load the MCP proxy documents:', error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, mcpProxyId]);

  return { documents, failed };
}
