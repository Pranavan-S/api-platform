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

import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { PublicationSummaryItem } from '../../../../utils/types';

export type ChipColor = 'default' | 'success' | 'warning';

type PublicationStatus = PublicationSummaryItem['status'];

const statusMessages = defineMessages({
  published: { id: 'aiWorkspace.pages.appShell.appShellPages.publish.status.published', defaultMessage: 'Published' },
  deprecated: { id: 'aiWorkspace.pages.appShell.appShellPages.publish.status.deprecated', defaultMessage: 'Deprecated' },
  notPublished: { id: 'aiWorkspace.pages.appShell.appShellPages.publish.status.notPublished', defaultMessage: 'Not published' },
});

/** A status that has a page on the portal to link to, now or until it was deprecated. */
export const isListedOnPortal = (status: PublicationStatus): boolean =>
  status === 'PUBLISHED' || status === 'DEPRECATED';

/**
 * The status chip shown on every portal card. A pending draft is reported
 * separately on the card, so it never changes which status is shown here.
 */
export const publicationStatusMeta = (
  status: PublicationStatus
): { color: ChipColor; label: MessageDescriptor } => {
  switch (status) {
    case 'PUBLISHED':
      return { color: 'success', label: statusMessages.published };
    case 'DEPRECATED':
      return { color: 'warning', label: statusMessages.deprecated };
    default:
      return { color: 'default', label: statusMessages.notPublished };
  }
};

// The API Portal's own app mount prefix (portals/api-portal/src/utils/constants.js:
// PORTAL_BASE_PATH) — fixed there, not per-deployment configurable.
const PORTAL_APP_BASE_PATH = 'api-portal';
// Handle of the view every org is seeded with. A best-effort assumption: the
// publication summary does not say which view a listing resolved into.
const DEFAULT_PORTAL_VIEW_HANDLE = 'default';

/**
 * The portal serves an MCP server's page at
 * `/{PORTAL_APP_BASE_PATH}/{orgHandle}/views/{viewHandle}/mcp/{handle}`. Best
 * effort, like the control plane's REST link: it assumes the seeded default view
 * and that the portal reuses this workspace's org and proxy handles.
 */
export const buildViewInPortalUrl = (portalUrl: string, orgHandle: string, mcpProxyId: string): string => {
  const url = new URL(portalUrl);
  url.pathname = [
    url.pathname.replace(/\/+$/, ''),
    PORTAL_APP_BASE_PATH,
    encodeURIComponent(orgHandle),
    'views',
    DEFAULT_PORTAL_VIEW_HANDLE,
    'mcp',
    encodeURIComponent(mcpProxyId),
  ].join('/');
  return url.toString();
};
