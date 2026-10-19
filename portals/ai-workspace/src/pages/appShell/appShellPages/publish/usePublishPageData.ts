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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { getApiPortal, type ApiPortal } from '../../../../apis/apiPortalApis';
import { PLATFORM_API_BASE_URL } from '../../../../paths';
import { getHttpStatus } from '../../../../utils/apiError';
import { logger } from '../../../../utils/logger';
import type { MCPServer, Publication, PublicationDraftDetails } from '../../../../utils/types';
import {
  buildProductionUrlOptions,
  definitionToText,
  resolveDraftFormValues,
  type DraftFormValues,
  type McpDefinition,
} from './mcpPublishForm';
import { useMcpDeployedGateways } from '../../../../hooks/useMcpDeployedGateways';

/** What the editor opens with: the details and the definition, from the freshest tier that has them. */
export type PublishSeed = { definitionText: string; values: DraftFormValues };

type Definition = McpDefinition | undefined;

/** A 404 is "nothing saved yet", not a failure. */
async function orUndefinedOn404<T>(call: Promise<T>): Promise<T | undefined> {
  try {
    return await call;
  } catch (error) {
    if (getHttpStatus(error) === 404) return undefined;
    throw error;
  }
}

type Loaded = {
  server: MCPServer;
  portal?: ApiPortal;
  draft?: PublicationDraftDetails;
  publication?: Publication;
  draftDefinition: Definition;
  publicationDefinition: Definition;
};

/**
 * Every read behind the publish page, and what can be derived from them without
 * the user's edits.
 *
 * The draft and the live listing load in parallel: a portal can be live and have
 * a draft edit in progress. The Capabilities tab's definition comes from the
 * freshest tier that has one — the draft's, then the live listing's, then what
 * the proxy itself exposes. The gateways the proxy is deployed to are read for
 * the Production URL's choices and its default (the first); a failed read only
 * leaves the choices empty.
 *
 * `isLoading` is latched: the page is loading until everything it opens on is
 * ready, and not again for the refetches that follow its own saves.
 */
export function usePublishPageData(
  apiPortalId: string,
  serverId: string,
  organizationId: string,
  wantPublishedDefinition: boolean
) {
  const gateways = useMcpDeployedGateways(organizationId, serverId);
  const [loaded, setLoaded] = useState<Loaded>();
  const [error, setError] = useState<Error>();
  const [reloadKey, setReloadKey] = useState(0);
  const [publishedDefinition, setPublishedDefinition] = useState<{
    definition: Definition;
    failed: boolean;
    isLoading: boolean;
  }>({ definition: undefined, failed: false, isLoading: false });

  useEffect(() => {
    if (!organizationId || !serverId || !apiPortalId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [server, draft, publication, portal, draftDefinition] = await Promise.all([
          mcpProxiesApis.getMCPServer(serverId, PLATFORM_API_BASE_URL),
          orUndefinedOn404(mcpProxiesApis.getMcpProxyApiPortalDraft(apiPortalId, serverId, PLATFORM_API_BASE_URL)),
          orUndefinedOn404(mcpProxiesApis.getMcpProxyApiPortalPublication(apiPortalId, serverId, PLATFORM_API_BASE_URL)),
          getApiPortal(apiPortalId, PLATFORM_API_BASE_URL).catch(() => undefined),
          orUndefinedOn404(
            mcpProxiesApis.getMcpProxyApiPortalDraftDefinition(apiPortalId, serverId, PLATFORM_API_BASE_URL)
          ),
        ]);
        // Only read when the draft has nothing of its own to open the editor with.
        const publicationDefinition =
          draftDefinition === undefined && publication
            ? await orUndefinedOn404(
                mcpProxiesApis.getMcpProxyApiPortalPublicationDefinition(apiPortalId, serverId, PLATFORM_API_BASE_URL)
              )
            : undefined;
        if (cancelled) return;
        setError(undefined);
        setLoaded({ server, portal, draft, publication, draftDefinition, publicationDefinition });
      } catch (loadError) {
        logger.error('Failed to load the MCP publish page:', loadError);
        if (!cancelled) setError(loadError instanceof Error ? loadError : new Error(String(loadError)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, serverId, apiPortalId, reloadKey]);

  // The live definition is read for the viewer only when it is actually shown.
  const isLive = Boolean(loaded?.publication);
  useEffect(() => {
    if (!wantPublishedDefinition || !isLive) return;
    let cancelled = false;
    setPublishedDefinition((current) => ({ ...current, failed: false, isLoading: true }));
    void (async () => {
      try {
        const definition = await orUndefinedOn404(
          mcpProxiesApis.getMcpProxyApiPortalPublicationDefinition(apiPortalId, serverId, PLATFORM_API_BASE_URL)
        );
        if (!cancelled) setPublishedDefinition({ definition, failed: false, isLoading: false });
      } catch (readError) {
        logger.error('Failed to load the published definition:', readError);
        if (!cancelled) setPublishedDefinition({ definition: undefined, failed: true, isLoading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wantPublishedDefinition, isLive, apiPortalId, serverId, reloadKey]);

  const productionUrlOptions = useMemo(
    () => buildProductionUrlOptions(gateways.gateways, loaded?.server.context),
    [gateways.gateways, loaded?.server.context]
  );

  // Latched: nothing is shown until the page's first full read has settled.
  const [isReady, setIsReady] = useState(false);
  if (!isReady && !gateways.isLoading && (loaded || error)) setIsReady(true);

  const seed = useMemo<PublishSeed | undefined>(() => {
    if (!isReady || !loaded) return undefined;
    const definition = loaded.draftDefinition ?? loaded.publicationDefinition ?? (loaded.server.capabilities as Definition);
    return {
      definitionText: definitionToText(definition),
      values: resolveDraftFormValues(loaded.draft, loaded.publication, loaded.server, productionUrlOptions[0]?.url),
    };
  }, [isReady, loaded, productionUrlOptions]);

  const refetch = useCallback(() => setReloadKey((key) => key + 1), []);

  return {
    server: loaded?.server,
    portal: loaded?.portal,
    draft: loaded?.draft,
    publication: loaded?.publication,
    error,
    isLoading: !isReady,
    productionUrlOptions,
    publishedDefinition,
    seed,
    refetch,
  };
}
