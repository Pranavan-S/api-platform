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

import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { renderWithProviders, screen, waitFor, within } from '../../../../test/utils';
import McpPublishHubPage from './McpPublishHubPage';

const mocks = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  navigate: vi.fn(),
  showSnackbar: vi.fn(),
  refetch: vi.fn(),
  allowed: true,
  documents: { documents: undefined, failed: false } as { documents?: unknown[]; failed: boolean },
  plans: { plans: undefined, failed: false } as { plans?: unknown[]; failed: boolean },
}));

vi.mock('../../../../apis/MCP/mcpProxiesApis', () => ({
  mcpProxiesApis: {
    saveMcpProxyApiPortalDraft: vi.fn(),
    saveMcpProxyApiPortalDraftDefinition: vi.fn(),
    publishSavedMcpProxyDraft: vi.fn(),
    unpublishMcpProxyFromApiPortal: vi.fn(),
    deprecateMcpProxyOnApiPortal: vi.fn(),
    saveMcpProxyApiPortalDraftThumbnail: vi.fn(),
    saveMcpProxyApiPortalDraftLandingPage: vi.fn(),
  },
}));
vi.mock('./usePublishPageData', () => ({ usePublishPageData: () => mocks.data }));
vi.mock('../../../../hooks/useMcpProxyDocuments', () => ({ useMcpProxyDocuments: () => mocks.documents }));
vi.mock('../../../../hooks/useSubscriptionPlans', () => ({ useSubscriptionPlans: () => mocks.plans }));
vi.mock('../../../../hooks/usePublishProject', () => ({
  usePublishProject: () => ({
    organizationId: 'org-1',
    publishPath: (suffix = '') => `/publish${suffix}`,
  }),
}));
vi.mock('../../../../hooks/useFillScrollArea', () => ({
  useFillScrollArea: () => ({ height: undefined, ref: () => undefined }),
}));
vi.mock('../../../../hooks/aiWorkspaceSnackbar', () => ({ default: () => mocks.showSnackbar }));
vi.mock('../../../../contexts/AppAuthContext', () => ({
  useAppAuth: () => ({ hasPermission: () => mocks.allowed }),
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mocks.navigate,
}));

const api = vi.mocked(mcpProxiesApis);

const SERVER = {
  id: 'travel',
  displayName: 'Travel MCP',
  capabilities: { tools: [{ name: 'search', description: 'Find trips' }, { name: 'book' }], resources: [], prompts: [] },
};
const DEFINITION = JSON.stringify({ tools: [{ name: 'search', description: 'Find trips' }], resources: [], prompts: [] }, null, 2);
const VALUES = {
  displayName: 'Travel MCP',
  version: 'v1',
  description: '',
  productionUrl: '',
  sandboxUrl: '',
  agentVisibility: 'VISIBLE',
  subscriptionPlanIds: [] as string[],
  docIds: [] as string[],
};
const PLANS = [
  { id: 'gold', displayName: 'Gold', status: 'ACTIVE' },
  { id: 'silver', displayName: 'Silver', status: 'ACTIVE' },
  { id: 'legacy', displayName: 'Legacy', status: 'INACTIVE' },
];
const DOCUMENTS = [
  { id: 'quickstart', type: 'HowTo', displayName: 'Quickstart' },
  { id: 'faq', type: 'Other', displayName: 'FAQ' },
];
const LIVE = { displayName: 'Travel MCP', version: 'v1', status: 'PUBLISHED', updatedAt: new Date().toISOString() };

/** What the data hook returns, for a proxy that has never been published unless said otherwise. */
const setData = (overrides: Record<string, unknown> = {}) => {
  mocks.data = {
    server: SERVER,
    portal: { name: 'Main Hub' },
    draft: undefined,
    publication: undefined,
    error: undefined,
    isLoading: false,
    productionUrlOptions: [],
    publishedDefinition: { definition: undefined, failed: false, isLoading: false },
    publishedLandingPage: { failed: false, text: undefined },
    seed: { definitionText: DEFINITION, landingPageFailed: false, values: VALUES },
    refetch: mocks.refetch,
    ...overrides,
  };
};

const httpError = (code?: string, status = 400) => Object.assign(new Error('Server said no.'), { code, status });

const open = () =>
  renderWithProviders(<McpPublishHubPage />, {
    route: '/publish/travel/portals/hub-1',
    path: '/publish/:serverId/portals/:apiPortalId',
  });

/** The split button's main side: every label shares its cell, so it is found by containing one. */
const mainButton = () =>
  screen.getAllByRole('button').find((button) => button.textContent?.includes('Deprecate'))!;

const pick = async (user: ReturnType<typeof open>['user'], action: RegExp) => {
  await user.click(screen.getByRole('button', { name: 'More publish actions' }));
  await user.click(await screen.findByRole('menuitem', { name: action }));
};

const calls = (...fns: unknown[]) => fns.map((fn) => (fn as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder[0]);

beforeEach(() => {
  mocks.allowed = true;
  mocks.navigate.mockReset();
  mocks.showSnackbar.mockReset();
  mocks.refetch.mockReset();
  mocks.documents = { documents: undefined, failed: false };
  mocks.plans = { plans: undefined, failed: false };
  URL.createObjectURL = vi.fn(() => 'blob:thumbnail');
  URL.revokeObjectURL = vi.fn();
  Object.values(api).forEach((fn) => fn.mockReset().mockResolvedValue(undefined as never));
  setData();
});

describe('what the page shows', () => {
  it('opens a first publish on the proxy\'s own details, under the hub\'s name', () => {
    open();
    expect(screen.getByText('Main Hub')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveValue('Travel MCP');
    expect(screen.getByRole('tab', { name: 'MCP Proxy Details' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: /Back to MCP Hubs/ })).toHaveAttribute('href', '/publish/travel');
  });

  it('waits while it loads, and says when it could not', () => {
    setData({ isLoading: true });
    const { unmount } = open();
    expect(screen.getByText('Loading publish details')).toBeInTheDocument();
    unmount();

    setData({ error: httpError(undefined, 500) });
    open();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('has nothing to show without the proxy', () => {
    setData({ server: undefined });
    open();
    expect(screen.getByText('Unable to load the publish details.')).toBeInTheDocument();
  });

  it('has no published version to switch to until something is live', () => {
    open();
    expect(screen.getByRole('button', { name: 'Published' })).toBeDisabled();
  });

  it('lets the capabilities be chosen from the proxy\'s own, with the saved choice ticked', async () => {
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Capabilities' }));
    await user.click(screen.getByText('Tools'));
    expect(screen.getByRole('checkbox', { name: 'search' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'book' })).not.toBeChecked();
  });
});

describe('the Subscription Plans tab', () => {
  beforeEach(() => {
    mocks.plans = { plans: PLANS, failed: false };
  });

  const seedPlans = (subscriptionPlanIds: string[]) =>
    setData({ seed: { definitionText: DEFINITION, values: { ...VALUES, subscriptionPlanIds } } });

  it('lists the plans on offer with the saved selection ticked', async () => {
    seedPlans(['silver']);
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Subscription Plans' }));
    expect(screen.getByRole('checkbox', { name: /Gold/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox', { name: /Silver/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('checkbox', { name: /Legacy/ })).not.toBeInTheDocument();
  });

  it('counts a changed selection as an edit, and saves it with the draft', async () => {
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Subscription Plans' }));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Gold/ }));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() =>
      expect(api.saveMcpProxyApiPortalDraft).toHaveBeenCalledWith(
        'hub-1',
        'travel',
        expect.objectContaining({ subscriptionPlanIds: ['gold'] }),
        expect.any(String)
      )
    );
  });

  it('drops a selected plan that no longer exists, and says so', async () => {
    seedPlans(['gold', 'deleted']);
    open();
    await waitFor(() =>
      expect(mocks.showSnackbar).toHaveBeenCalledWith(
        'A selected subscription plan no longer exists and was removed from the selection.',
        'warning'
      )
    );
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
  });

  it.each([
    ['saving a draft', () => screen.getByRole('button', { name: 'Save Draft' })],
    ['publishing', () => mainButton()],
  ])('stops %s while an inactive plan is still selected, and shows the plans', async (_name, button) => {
    seedPlans(['legacy']);
    const { user } = open();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    await user.click(button());

    expect(mocks.showSnackbar).toHaveBeenCalledWith('Clear inactive plans to save or publish: "Legacy".', 'warning');
    expect(screen.getByRole('tab', { name: 'Subscription Plans' })).toHaveAttribute('aria-selected', 'true');
    expect(api.saveMcpProxyApiPortalDraft).not.toHaveBeenCalled();
    expect(api.publishSavedMcpProxyDraft).not.toHaveBeenCalled();
  });

  it('saves again once the inactive plan is cleared', async () => {
    seedPlans(['legacy']);
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Subscription Plans' }));
    await user.click(screen.getByRole('checkbox', { name: /Legacy/ }));
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(api.saveMcpProxyApiPortalDraft).toHaveBeenCalled());
  });

  it('lists only what the live version holds, without being able to change it', async () => {
    setData({ publication: { ...LIVE, subscriptionPlanIds: ['silver'] } });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Subscription Plans' }));
    expect(screen.getByRole('checkbox', { name: /Silver/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Gold/ })).not.toBeInTheDocument();
  });

  it('says so when the plans cannot be read', async () => {
    mocks.plans = { plans: undefined, failed: true };
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Subscription Plans' }));
    expect(screen.getByText('Unable to load subscription plans.')).toBeInTheDocument();
  });
});

describe('the Documentation tab', () => {
  beforeEach(() => {
    mocks.documents = { documents: DOCUMENTS, failed: false };
  });

  it('lists the proxy\'s documents with the saved selection ticked', async () => {
    setData({ seed: { definitionText: DEFINITION, values: { ...VALUES, docIds: ['faq'] } } });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Documentation' }));
    expect(screen.getByRole('checkbox', { name: 'Quickstart' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'FAQ' })).toBeChecked();
  });

  it('counts a changed selection as an edit, and saves it with the draft', async () => {
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Documentation' }));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Quickstart' }));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() =>
      expect(api.saveMcpProxyApiPortalDraft).toHaveBeenCalledWith(
        'hub-1',
        'travel',
        expect.objectContaining({ docIds: ['quickstart'] }),
        expect.any(String)
      )
    );
  });

  it('does not count a selection put back in another order as an edit', async () => {
    setData({ seed: { definitionText: DEFINITION, values: { ...VALUES, docIds: ['quickstart', 'faq'] } } });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Documentation' }));
    await user.click(screen.getByRole('checkbox', { name: 'Quickstart' }));
    await user.click(screen.getByRole('checkbox', { name: 'Quickstart' }));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
  });

  it('drops a selected document that no longer exists, and says so', async () => {
    setData({ seed: { definitionText: DEFINITION, values: { ...VALUES, docIds: ['faq', 'deleted'] } } });
    open();
    await waitFor(() =>
      expect(mocks.showSnackbar).toHaveBeenCalledWith(
        'A selected document no longer exists and was removed from the selection.',
        'warning'
      )
    );
    // The server dropped it from the saved draft too, so there is nothing to save.
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
  });

  it('stays on the tab when the server rejects the publish, rather than jumping to the capabilities', async () => {
    api.publishSavedMcpProxyDraft.mockRejectedValue(httpError('PUBLICATION_VALIDATION_FAILED', 422));
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Documentation' }));
    await user.click(mainButton());

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Server said no.', 'error'));
    expect(screen.getByRole('tab', { name: 'Documentation' })).toHaveAttribute('aria-selected', 'true');
  });

  it('lists only what the live version holds, without checkboxes', async () => {
    setData({ publication: { ...LIVE, docIds: ['faq'] } });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Documentation' }));
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.queryByText('Quickstart')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('the thumbnail', () => {
  const stored = new Blob(['stored'], { type: 'image/png' });
  const png = () => new File(['png'], 'logo.png', { type: 'image/png' });
  const thumbnailInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;

  it('shows the thumbnail the listing already has in place of the monogram', () => {
    setData({ seed: { definitionText: DEFINITION, thumbnail: { blob: stored, inDraft: true }, values: VALUES } });
    open();
    expect(screen.getByRole('img', { name: 'Travel MCP' })).toHaveAttribute('src', 'blob:thumbnail');
    expect(screen.queryByText('TR')).not.toBeInTheDocument();
  });

  it('counts a picked image as an edit and uploads it after the details and the capabilities', async () => {
    const { container, user } = open();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    const image = png();
    await user.upload(thumbnailInput(container), image);
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Draft saved.', 'success'));
    expect(api.saveMcpProxyApiPortalDraftThumbnail).toHaveBeenCalledWith('hub-1', 'travel', image, expect.any(String));
    const [saveDetails, saveDefinition, saveThumbnail] = calls(
      api.saveMcpProxyApiPortalDraft,
      api.saveMcpProxyApiPortalDraftDefinition,
      api.saveMcpProxyApiPortalDraftThumbnail
    );
    expect(saveDetails).toBeLessThan(saveDefinition);
    expect(saveDefinition).toBeLessThan(saveThumbnail);
  });

  it('uploads the picked image before publishing, and does not publish without it', async () => {
    api.saveMcpProxyApiPortalDraftThumbnail.mockRejectedValue(httpError());
    const { container, user } = open();
    await user.upload(thumbnailInput(container), png());
    await user.click(mainButton());

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Server said no.', 'error'));
    expect(api.publishSavedMcpProxyDraft).not.toHaveBeenCalled();
  });

  it('puts the last saved image back when the server refuses the new one', async () => {
    api.saveMcpProxyApiPortalDraftThumbnail.mockRejectedValue(httpError());
    setData({ seed: { definitionText: DEFINITION, thumbnail: { blob: stored, inDraft: true }, values: VALUES } });
    const { container, user } = open();
    await user.upload(thumbnailInput(container), png());
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Server said no.', 'error'));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
  });

  it('does not send a thumbnail the draft already stores', async () => {
    setData({ seed: { definitionText: DEFINITION, thumbnail: { blob: stored, inDraft: true }, values: VALUES } });
    const { user } = open();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Draft saved.', 'success'));
    expect(api.saveMcpProxyApiPortalDraftThumbnail).not.toHaveBeenCalled();
  });

  it('sends a thumbnail that was only pre-filled from the live listing, so the draft can publish it', async () => {
    setData({ seed: { definitionText: DEFINITION, thumbnail: { blob: stored, inDraft: false }, values: VALUES } });
    const { user } = open();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() =>
      expect(api.saveMcpProxyApiPortalDraftThumbnail).toHaveBeenCalledWith('hub-1', 'travel', stored, expect.any(String))
    );
  });

  it('refuses an image the server would, without changing anything', async () => {
    const { container } = open();
    // The picker's own accept filter is bypassed here, as a renamed file would.
    fireEvent.change(thumbnailInput(container), {
      target: { files: [new File(['gif'], 'logo.gif', { type: 'image/gif' })] },
    });

    expect(mocks.showSnackbar).toHaveBeenCalledWith('Only JPEG and PNG images are supported.', 'error');
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
  });

  it('shows the live thumbnail read only', () => {
    setData({ publication: LIVE, publishedThumbnail: stored });
    open();
    expect(screen.getByRole('img', { name: 'Travel MCP' })).toHaveAttribute('src', 'blob:thumbnail');
    expect(screen.queryByRole('button', { name: 'Change thumbnail' })).not.toBeInTheDocument();
  });
});

describe('the Landing Page tab', () => {
  const seedWith = (landingPage?: { text: string; inDraft: boolean }, landingPageFailed = false) =>
    setData({ seed: { definitionText: DEFINITION, landingPage, landingPageFailed, values: VALUES } });
  const editor = () => screen.getByRole('textbox', { name: 'Landing page (Markdown)' });

  it('starts empty, and creates a page from the details and the capabilities on offer', async () => {
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Landing Page' }));
    expect(screen.getByText('No landing page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create from MCP proxy details' }));
    expect(editor()).toHaveValue('## Tools\n\n- **search** — Find trips\n');
    expect(screen.getByText(/Publishing replaces the MCP Hub’s default section/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
  });

  it('opens on the stored page, which is not an edit', async () => {
    seedWith({ text: '# Travel', inDraft: true });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Landing Page' }));
    expect(editor()).toHaveValue('# Travel');
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
  });

  it('saves an edited page with the draft, after the thumbnail', async () => {
    seedWith({ text: '# Travel', inDraft: true });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Landing Page' }));
    fireEvent.change(editor(), { target: { value: '# Travel\n\nMore' } });
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Draft saved.', 'success'));
    expect(api.saveMcpProxyApiPortalDraftLandingPage).toHaveBeenCalledWith(
      'hub-1',
      'travel',
      '# Travel\n\nMore',
      expect.any(String)
    );
    const [saveDefinition, saveLandingPage] = calls(
      api.saveMcpProxyApiPortalDraftDefinition,
      api.saveMcpProxyApiPortalDraftLandingPage
    );
    expect(saveDefinition).toBeLessThan(saveLandingPage);
  });

  it('does not send a page the draft already stores', async () => {
    seedWith({ text: '# Travel', inDraft: true });
    const { user } = open();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Draft saved.', 'success'));
    expect(api.saveMcpProxyApiPortalDraftLandingPage).not.toHaveBeenCalled();
  });

  it('publishes the page the draft holds, and stops when it cannot be saved', async () => {
    api.saveMcpProxyApiPortalDraftLandingPage.mockRejectedValue(httpError());
    seedWith({ text: '# Live', inDraft: false });
    const { user } = open();
    await user.click(mainButton());

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Server said no.', 'error'));
    expect(api.publishSavedMcpProxyDraft).not.toHaveBeenCalled();
  });

  it('offers no editor when the stored page could not be read', async () => {
    seedWith(undefined, true);
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Landing Page' }));
    expect(screen.getByText('Unable to load the landing page.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Landing page (Markdown)' })).not.toBeInTheDocument();
  });

  it('shows the live page read only', async () => {
    setData({ publication: LIVE, publishedLandingPage: { failed: false, text: '# Live page' } });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Landing Page' }));
    expect(screen.getByRole('region', { name: 'Published page' })).toHaveTextContent('Live page');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('says so when the live page cannot be read', async () => {
    setData({ publication: LIVE, publishedLandingPage: { failed: true, text: undefined } });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Landing Page' }));
    expect(screen.getByText('Unable to load the landing page.')).toBeInTheDocument();
  });
});

describe('saving a draft', () => {
  it('cannot be saved until something has changed', async () => {
    const { user } = open();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
  });

  it('saves the details, then the capabilities, and reads the page again', async () => {
    const { user } = open();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Draft saved.', 'success'));
    expect(api.saveMcpProxyApiPortalDraft).toHaveBeenCalledWith(
      'hub-1',
      'travel',
      expect.objectContaining({ displayName: 'Travel MCP', version: 'v12' }),
      expect.any(String)
    );
    expect(api.saveMcpProxyApiPortalDraftDefinition).toHaveBeenCalledWith(
      'hub-1',
      'travel',
      { tools: [{ name: 'search', description: 'Find trips' }], resources: [], prompts: [] },
      expect.any(String)
    );
    const [saveDetails, saveDefinition] = calls(api.saveMcpProxyApiPortalDraft, api.saveMcpProxyApiPortalDraftDefinition);
    expect(saveDetails).toBeLessThan(saveDefinition);
    expect(mocks.refetch).toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('saves a changed choice of capabilities', async () => {
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Capabilities' }));
    await user.click(screen.getByText('Tools'));
    await user.click(screen.getByRole('checkbox', { name: 'book' }));
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(api.saveMcpProxyApiPortalDraftDefinition).toHaveBeenCalled());
    const [, , definition] = api.saveMcpProxyApiPortalDraftDefinition.mock.calls[0];
    expect((definition as { tools: { name: string }[] }).tools.map((tool) => tool.name)).toEqual(['search', 'book']);
  });

  it('says what went wrong and does not go on to the capabilities', async () => {
    api.saveMcpProxyApiPortalDraft.mockRejectedValue(httpError());
    const { user } = open();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Server said no.', 'error'));
    expect(api.saveMcpProxyApiPortalDraftDefinition).not.toHaveBeenCalled();
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('explains a draft that has gone missing rather than quoting the server', async () => {
    api.saveMcpProxyApiPortalDraftDefinition.mockRejectedValue(httpError('DRAFT_NOT_FOUND', 404));
    const { user } = open();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() =>
      expect(mocks.showSnackbar).toHaveBeenCalledWith(
        'Unable to save the draft. Your changes are still on this page. Try again.',
        'error'
      )
    );
  });

  it('saves nothing when the details are not valid, and shows why', async () => {
    const { user } = open();
    await user.clear(screen.getByLabelText(/Name/));
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(await screen.findByText('Enter a name.')).toBeInTheDocument();
    expect(api.saveMcpProxyApiPortalDraft).not.toHaveBeenCalled();
  });
});

describe('publishing', () => {
  it('saves the details and the capabilities, publishes, and returns to the hubs', async () => {
    const { user } = open();
    await user.click(mainButton());

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/publish/travel'));
    expect(api.publishSavedMcpProxyDraft).toHaveBeenCalledWith('hub-1', 'travel', expect.any(String));
    const [saveDetails, saveDefinition, publish] = calls(
      api.saveMcpProxyApiPortalDraft,
      api.saveMcpProxyApiPortalDraftDefinition,
      api.publishSavedMcpProxyDraft
    );
    expect(saveDetails).toBeLessThan(saveDefinition);
    expect(saveDefinition).toBeLessThan(publish);
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Published to Main Hub.', 'success');
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it('does not publish when the details are not valid', async () => {
    const { user } = open();
    await user.clear(screen.getByRole('textbox', { name: /^Version/ }));
    await user.click(mainButton());

    expect(await screen.findByText('Enter a version.')).toBeInTheDocument();
    expect(api.saveMcpProxyApiPortalDraft).not.toHaveBeenCalled();
    expect(api.publishSavedMcpProxyDraft).not.toHaveBeenCalled();
  });

  it('stays put when the draft cannot be saved', async () => {
    api.saveMcpProxyApiPortalDraft.mockRejectedValue(httpError());
    const { user } = open();
    await user.click(mainButton());

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Server said no.', 'error'));
    expect(api.publishSavedMcpProxyDraft).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('takes the user to the capabilities when the server rejects the definition', async () => {
    api.publishSavedMcpProxyDraft.mockRejectedValue(httpError('PUBLICATION_VALIDATION_FAILED', 422));
    const { user } = open();
    await user.click(mainButton());

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Capabilities' })).toHaveAttribute('aria-selected', 'true'));
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Server said no.', 'error');
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('is off for a user who may not publish', () => {
    mocks.allowed = false;
    open();
    expect(mainButton()).toBeDisabled();
  });

  it('names the portal the card linked from', async () => {
    renderWithProviders(<McpPublishHubPage />, {
      route: { pathname: '/publish/travel/portals/hub-1', state: { portalName: 'Linked Hub' } } as never,
      path: '/publish/:serverId/portals/:apiPortalId',
    });
    expect(await screen.findAllByText('Linked Hub')).not.toHaveLength(0);
  });
});

describe('a proxy that is live', () => {
  beforeEach(() => setData({ publication: LIVE, draft: undefined }));

  it('opens on the published version, read only, without the action buttons', () => {
    open();
    expect(screen.getByRole('button', { name: 'Published' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument();
  });

  it('lists what the live version holds on its Capabilities tab', async () => {
    setData({
      publication: LIVE,
      publishedDefinition: { definition: { tools: [{ name: 'live-tool' }] }, failed: false, isLoading: false },
    });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Capabilities' }));
    expect(screen.getByText('Total: 1')).toBeInTheDocument();
  });

  it('says when the live capabilities cannot be loaded', async () => {
    setData({
      publication: LIVE,
      publishedDefinition: { definition: undefined, failed: true, isLoading: false },
    });
    const { user } = open();
    await user.click(screen.getByRole('tab', { name: 'Capabilities' }));
    expect(screen.getByText('Unable to load the published capabilities.')).toBeInTheDocument();
  });

  it('switches to the draft to edit, where the main action reads Republish', async () => {
    const { user } = open();
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getAllByText('Republish').length).toBeGreaterThan(0);
  });

  it('unpublishes only after the proxy\'s name is typed, then returns to the hubs', async () => {
    const { user } = open();
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await pick(user, /Unpublish/);
    await user.click(mainButton());

    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    expect(api.unpublishMcpProxyFromApiPortal).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole('textbox'), 'Travel MCP');
    await user.click(confirm);

    await waitFor(() => expect(api.unpublishMcpProxyFromApiPortal).toHaveBeenCalledWith('hub-1', 'travel', expect.any(String)));
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Unpublished from Main Hub.', 'success');
    expect(mocks.navigate).toHaveBeenCalledWith('/publish/travel');
  });

  it('does not unpublish when the confirmation is cancelled', async () => {
    const { user } = open();
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await pick(user, /Unpublish/);
    await user.click(mainButton());
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(api.unpublishMcpProxyFromApiPortal).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('stays on the page and reads it again when unpublishing fails', async () => {
    api.unpublishMcpProxyFromApiPortal.mockRejectedValue(httpError());
    const { user } = open();
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await pick(user, /Unpublish/);
    await user.click(mainButton());
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Travel MCP');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(mocks.showSnackbar).toHaveBeenCalledWith('Server said no.', 'error'));
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it('deprecates after confirmation, then returns to the hubs', async () => {
    const { user } = open();
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await pick(user, /Deprecate/);
    await user.click(mainButton());
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Travel MCP');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(api.deprecateMcpProxyOnApiPortal).toHaveBeenCalledWith('hub-1', 'travel', expect.any(String)));
    expect(mocks.showSnackbar).toHaveBeenCalledWith('Deprecated on Main Hub.', 'success');
    expect(mocks.navigate).toHaveBeenCalledWith('/publish/travel');
  });

  it('cannot deprecate a listing that is already deprecated', async () => {
    setData({ publication: { ...LIVE, status: 'DEPRECATED' } });
    const { user } = open();
    await user.click(screen.getByRole('button', { name: 'Draft' }));
    await user.click(screen.getByRole('button', { name: 'More publish actions' }));
    expect(await screen.findByRole('menuitem', { name: /Deprecate/ })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('unsaved edits', () => {
  it('shows the unsaved-changes note once something is edited', async () => {
    setData({ draft: { displayName: 'Travel MCP', version: 'v1', updatedAt: new Date().toISOString() } });
    const { user } = open();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /^Version/ }), '2');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: /^Version/ }), { target: { value: 'v1' } });
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
});
