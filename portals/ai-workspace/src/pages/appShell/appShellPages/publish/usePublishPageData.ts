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
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getApiPortal, type ApiPortal } from '../../../../apis/apiPortalApis';
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { useMcpDeployedGateways } from '../../../../hooks/useMcpDeployedGateways';
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

/** `inDraft`: the draft already stores it, so saving need not send it. */
export type LandingPageSeed = { text: string; inDraft: boolean };

/**
 * What the editor opens with, from the freshest tier that has each part.
 * `landingPageFailed`: a tier has a landing page but reading it failed.
 */
export type PublishSeed = {
  definitionText: string;
  landingPage?: LandingPageSeed;
  landingPageFailed: boolean;
  values: DraftFormValues;
};

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

/** A stored part of a listing, read when the listing's `has…` flag says it exists. */
type ReadAsset = { text?: string; failed: boolean };

/**
 * A part of a listing that the listing's flag says exists. One that cannot be read is
 * reported as failed rather than failing the page, and is never mistaken for one that
 * does not exist.
 */
async function readAsset(exists: boolean | undefined, read: () => Promise<string>): Promise<ReadAsset> {
  if (!exists) return { failed: false };
  try {
    return { text: await read(), failed: false };
  } catch (error) {
    logger.error('Failed to read a part of the publication:', error);
    return { failed: true };
  }
}

type Loaded = {
  server: MCPServer;
  portal?: ApiPortal;
  draft?: PublicationDraftDetails;
  publication?: Publication;
  draftDefinition: Definition;
  publicationDefinition: Definition;
  draftLandingPage: ReadAsset;
  publicationLandingPage: ReadAsset;
};

/**
 * Every read behind the publish page, and what can be derived from them without
 * the user's edits.
 *
 * The draft and the live listing load in parallel: a hub can be live and have a
 * draft edit in progress. The Capabilities tab's definition comes from the
 * freshest tier that has one — the draft's, then the live listing's, then what
 * the proxy itself exposes. The gateways the proxy is deployed to are read for
 * the Production URL's choices and its default (the first); a failed read only
 * leaves the choices empty.
 *
 * The landing page comes from the draft if it has one, else from the live listing, by the
 * `hasLandingPage` flags rather than by whether a read worked: a failed read must not fall
 * through to the live page, or saving would overwrite the draft's own with it. The live one
 * is read whenever the listing has it, for the published view.
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
        const [draftLandingPage, publicationLandingPage] = await Promise.all([
          readAsset(draft?.hasLandingPage, () =>
            mcpProxiesApis.getMcpProxyApiPortalDraftLandingPage(apiPortalId, serverId, PLATFORM_API_BASE_URL)
          ),
          readAsset(publication?.hasLandingPage, () =>
            mcpProxiesApis.getMcpProxyApiPortalPublicationLandingPage(apiPortalId, serverId, PLATFORM_API_BASE_URL)
          ),
        ]);
        if (cancelled) return;
        setError(undefined);
        setLoaded({
          server,
          portal,
          draft,
          publication,
          draftDefinition,
          publicationDefinition,
          draftLandingPage,
          publicationLandingPage,
        });
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
    const landingPage = loaded.draft?.hasLandingPage
      ? { read: loaded.draftLandingPage, inDraft: true }
      : loaded.publication?.hasLandingPage
        ? { read: loaded.publicationLandingPage, inDraft: false }
        : undefined;
    return {
      definitionText: definitionToText(definition),
      landingPage:
        landingPage?.read.text === undefined ? undefined : { text: landingPage.read.text, inDraft: landingPage.inDraft },
      landingPageFailed: Boolean(landingPage?.read.failed),
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
    publishedLandingPage: loaded?.publicationLandingPage ?? { failed: false },
    seed,
    refetch,
  };
}
