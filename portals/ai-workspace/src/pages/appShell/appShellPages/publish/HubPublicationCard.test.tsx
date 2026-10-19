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
import type { PublicationSummaryItem } from '../../../../utils/types';
import { renderWithProviders, screen } from '../../../../test/utils';
import { HubPublicationCard } from './HubPublicationCard';

const publication = (overrides: Partial<PublicationSummaryItem> = {}): PublicationSummaryItem => ({
  apiPortalId: 'hub-1',
  apiPortalName: 'Main Hub',
  apiPortalDescription: 'The default hub',
  apiPortalUrl: 'https://hub.example.com',
  status: 'PUBLISHED',
  publicationUpdatedAt: new Date().toISOString(),
  ...overrides,
});

const renderCard = (item: PublicationSummaryItem) =>
  renderWithProviders(
    <HubPublicationCard
      mcpProxyId="travel"
      orgHandle="acme"
      publication={item}
      publishPath={(id) => `/publish/travel/portals/${id}`}
    />
  );

/** The "View in MCP Hub" control, which is not a link at all when there is nowhere to go. */
const viewInHub = () => screen.getByText('View in MCP Hub').closest('a')!;

describe('HubPublicationCard', () => {
  it('shows the hub, its status, and links to publish and to the hub\'s page', () => {
    renderCard(publication());
    expect(screen.getByText('Main Hub')).toBeInTheDocument();
    expect(screen.getByText('The default hub')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to publish' })).toHaveAttribute('href', '/publish/travel/portals/hub-1');
    expect(screen.getByRole('link', { name: 'View in MCP Hub' })).toHaveAttribute(
      'href',
      'https://hub.example.com/api-portal/acme/views/default/mcp/travel'
    );
  });

  it('marks a deprecated listing and still links to it', () => {
    renderCard(publication({ status: 'DEPRECATED' }));
    expect(screen.getByText('Deprecated')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View in MCP Hub' })).toBeEnabled();
  });

  it('does not link to a page that was never published', () => {
    renderCard(publication({ status: 'NOT_PUBLISHED', publicationUpdatedAt: undefined }));
    expect(screen.getByText('Not published')).toBeInTheDocument();
    expect(viewInHub()).toHaveClass('Mui-disabled');
    expect(viewInHub()).not.toHaveAttribute('href');
  });

  it('has no page to link to without a hub address', () => {
    renderCard(publication({ apiPortalUrl: undefined }));
    expect(viewInHub()).toHaveClass('Mui-disabled');
    expect(viewInHub()).not.toHaveAttribute('href');
  });

  it('cannot open the publish flow for a hub with no id', () => {
    renderCard(publication({ apiPortalId: undefined }));
    expect(screen.getByText('Go to publish').closest('a')).toHaveClass('Mui-disabled');
  });

  it('falls back to the hub id when it has no name', () => {
    renderCard(publication({ apiPortalName: undefined }));
    expect(screen.getByText('hub-1')).toBeInTheDocument();
  });
});
