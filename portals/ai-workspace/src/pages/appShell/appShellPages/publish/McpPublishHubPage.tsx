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

import React, { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ChevronLeft } from '@wso2/oxygen-ui-icons-react';
import { alpha, Box, Button, PageTitle, Stack, Tab, Tabs } from '@wso2/oxygen-ui';

import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { SCOPES } from '../../../../auth/permissions';
import ErrorAlert from '../../../../Components/common/ErrorAlert';
import { useAppAuth } from '../../../../contexts/AppAuthContext';
import { formatRelativeTime } from '../../../../contexts/llmProvider';
import useAIWorkspaceSnackbar from '../../../../hooks/aiWorkspaceSnackbar';
import { useFillScrollArea } from '../../../../hooks/useFillScrollArea';
import { useFrozenWhile } from '../../../../hooks/useFrozenWhile';
import { usePublishProject } from '../../../../hooks/usePublishProject';
import { useMcpProxyDocuments } from '../../../../hooks/useMcpProxyDocuments';
import { useObjectUrl } from '../../../../hooks/useObjectUrl';
import { PLATFORM_API_BASE_URL } from '../../../../paths';
import { getErrorCode, getErrorMessage } from '../../../../utils/apiError';

import { McpProxyDetailsTab } from './McpProxyDetailsTab';
import { AppPage } from './AppPage';
import { CapabilitiesTab, type CapabilitiesTabProps } from './CapabilitiesTab';
import { ConfirmDialog } from './ConfirmDialog';
import { DocumentsTab } from './DocumentsTab';
import {
  draftFormValuesToInput,
  emptyDraftFormValues,
  parseDefinitionText,
  resolveDraftFormValues,
  sameSelection,
  validateDraftFormValues,
  validateThumbnailFile,
  definitionToText,
  type DraftFormField,
  type DraftFormValues,
} from './mcpPublishForm';
import { PublicationVersionCard, type PublicationVersionTone } from './PublicationVersionCard';
import { PublicationVersionToggle } from './PublicationVersionToggle';
import { PublishActionsBar } from './PublishActionsBar';
import { ErrorState, LoadingState } from './PublishStates';
import { usePublishAssets } from './usePublishAssets';
import { usePublishPageData } from './usePublishPageData';

const messages = defineMessages({
  draftNotFound: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.draftNotFound',
    defaultMessage: 'Unable to save the draft. Your changes are still on this page. Try again.',
  },
  loading: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.loading',
    defaultMessage: 'Loading publish details',
  },
  loadFailed: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.loadFailed',
    defaultMessage: 'Unable to load the publish details.',
  },
  saveFailed: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.saveFailed',
    defaultMessage: 'Failed to save the draft.',
  },
  draftSaved: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.draftSaved',
    defaultMessage: 'Draft saved.',
  },
  detailsSavedOnly: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.detailsSavedOnly',
    defaultMessage: 'Details saved. The capabilities could not be saved.',
  },
  publishFailed: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.publishFailed',
    defaultMessage: 'Failed to publish the MCP proxy.',
  },
  published: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.published',
    defaultMessage: 'Published to {portal}.',
  },
  unpublishFailed: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.unpublishFailed',
    defaultMessage: 'Failed to unpublish the MCP proxy.',
  },
  unpublished: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.unpublished',
    defaultMessage: 'Unpublished from {portal}.',
  },
  deprecateFailed: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.deprecateFailed',
    defaultMessage: 'Failed to deprecate the MCP proxy.',
  },
  deprecated: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.deprecated',
    defaultMessage: 'Deprecated on {portal}.',
  },
  removedDocuments: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.removedDocuments',
    defaultMessage: 'A selected document no longer exists and was removed from the selection.',
  },
  edited: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.edited',
    defaultMessage: 'Edited {time}',
  },
  updated: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.updated',
    defaultMessage: 'Updated {time}',
  },
  deprecatedAt: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.deprecatedAt',
    defaultMessage: 'Deprecated {time}',
  },
  loadingPublishedSpec: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.loadingPublishedSpec',
    defaultMessage: 'Loading the published capabilities',
  },
  publishedSpecFailed: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.publishedSpecFailed',
    defaultMessage: 'Unable to load the published capabilities.',
  },
  tabDetails: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.tabDetails',
    defaultMessage: 'MCP Proxy Details',
  },
  tabCapabilities: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.tabCapabilities',
    defaultMessage: 'Capabilities',
  },
  tabPlans: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.tabPlans',
    defaultMessage: 'Subscription Plans',
  },
  tabDocs: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.tabDocs',
    defaultMessage: 'Documentation',
  },
  tabLanding: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.tabLanding',
    defaultMessage: 'Landing Page',
  },
  typeToConfirm: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.typeToConfirm',
    defaultMessage: 'Type "{name}" to confirm',
  },
  unpublishMessage: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.unpublishMessage',
    defaultMessage: 'This removes the MCP proxy "{name}" from {portal}. You can publish it again later.',
  },
  unpublishTitle: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.unpublishTitle',
    defaultMessage: 'Unpublish this MCP proxy?',
  },
  deprecateMessage: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.deprecateMessage',
    defaultMessage: 'The MCP proxy "{name}" will be marked as deprecated on {portal}. It will remain listed.',
  },
  deprecateTitle: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.deprecateTitle',
    defaultMessage: 'Deprecate this MCP proxy?',
  },
  unsavedChanges: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.unsavedChanges',
    defaultMessage: 'Unsaved changes',
  },
  editedUnsaved: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.editedUnsaved',
    defaultMessage: 'Edited {time} · {unsaved}',
  },
  back: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.back',
    defaultMessage: 'Back to MCP Hubs',
  },
  title: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.title',
    defaultMessage: 'Publish {name}',
  },
  subtitle: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.page.subtitle',
    defaultMessage: 'To {portal}',
  },
});

/** Below this the window is too short to fit the page without scrolling, so it scrolls instead. */
const MIN_PAGE_HEIGHT = 420;

/** The action bar's row, held open while it is hidden. */
const ACTION_BAR_HEIGHT = 40;

/** The fields that show a validation message. */
const FORM_FIELDS: DraftFormField[] = ['displayName', 'version', 'productionUrl', 'sandboxUrl'];

type PublishTab = 'details' | 'capabilities' | 'documentations';

/** Which action is currently in flight, so the right button (and only that one) shows busy. */
type PendingAction = 'idle' | 'saving' | 'publishing' | 'unpublishing' | 'deprecating';

/**
 * The banner's unsaved-changes warning: a tinted highlight on the text itself. An inline
 * span's padding does not take part in line layout, so it cannot make the banner larger.
 */
const unsavedChanges = (
  <Box
    component="span"
    sx={(theme) => ({
      bgcolor: alpha(theme.palette.warning.main, 0.16),
      borderRadius: 1,
      color: 'warning.dark',
      fontWeight: 600,
      mx: 0.5,
      px: 1,
      py: 0.25,
    })}
  >
    <FormattedMessage {...messages.unsavedChanges} />
  </Box>
);

const bold = (text: ReactNode) => (
  <Box component="span" sx={{ fontWeight: 700 }}>
    {text}
  </Box>
);

/**
 * The publish/unpublish/deprecate flow for one MCP proxy on one API Portal, laid
 * out like the control plane's publish page: "MCP Proxy Details" and "Capabilities"
 * tabs over a draft/published switch, with Save Draft and a split Publish button
 * beneath.
 *
 * Save Draft always writes `.../draft`, and writes `.../draft/definition` too
 * only when the definition parses, reporting honestly when it couldn't;
 * Publish requires both saves to succeed before it calls `.../publish`, since
 * the server's publish takes no body and only publishes what the draft holds.
 */
export default function McpPublishHubPage(): React.JSX.Element {
  const intl = useIntl();
  const { serverId = '', apiPortalId = '' } = useParams<{ serverId: string; apiPortalId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const showSnackbar = useAIWorkspaceSnackbar();
  const { hasPermission } = useAppAuth();
  const { organizationId, publishPath } = usePublishProject();
  // The page fills the visible area and only its middle scrolls, so switching tabs
  // or opening the editor never moves the header or the action buttons.
  const fill = useFillScrollArea<HTMLDivElement>(MIN_PAGE_HEIGHT);

  const portalsPath = publishPath(`/${encodeURIComponent(serverId)}`);

  const [tab, setTab] = useState<PublishTab>('details');
  // Which version the user picked; until they pick, the live version if there is one, else the draft.
  const [chosenView, setChosenView] = useState<PublicationVersionTone>();
  const data = usePublishPageData(apiPortalId, serverId, organizationId, chosenView !== 'draft' && tab === 'capabilities');

  // Passed by the portal card that linked here; falls back to the portal's own name, then its handle,
  // on a direct link or refresh, where there is no navigation state.
  const portalName =
    (location.state as { portalName?: string } | null)?.portalName ?? data.portal?.name ?? apiPortalId;

  const [values, setValues] = useState<DraftFormValues>(emptyDraftFormValues);
  const [touched, setTouched] = useState<Partial<Record<DraftFormField, boolean>>>({});
  const [definitionText, setDefinitionText] = useState('');
  // The parts of the listing saved on their own: the thumbnail.
  const assets = usePublishAssets(apiPortalId, serverId);
  // What the server holds for the fields shown, so edits made since can be told apart.
  const [saved, setSaved] = useState({ definitionText: '', values: emptyDraftFormValues });
  const [pendingAction, setPendingAction] = useState<PendingAction>('idle');
  // An action saves in steps, each refetching these; they are shown once, when it ends.
  const draft = useFrozenWhile(data.draft, pendingAction !== 'idle');
  const publication = useFrozenWhile(data.publication, pendingAction !== 'idle');
  const [confirmingUnpublish, setConfirmingUnpublish] = useState(false);
  const [confirmingDeprecate, setConfirmingDeprecate] = useState(false);
  const [initialized, setInitialized] = useState(false);
  // Read once the Documentation tab is open or a selection is held to check it against.
  const documents = useMcpProxyDocuments(serverId, tab === 'documentations' || values.docIds.length > 0);

  // Seeds the editor once, when everything has settled (success or the expected
  // 404), so a later refetch can't overwrite edits in progress.
  useEffect(() => {
    if (initialized || !data.seed) return;
    setValues(data.seed.values);
    setDefinitionText(data.seed.definitionText);
    assets.seed(data.seed);
    setSaved({ definitionText: data.seed.definitionText, values: data.seed.values });
    setInitialized(true);
  }, [initialized, data.seed, assets.seed]);

  const thumbnailUrl = useObjectUrl(assets.thumbnail);
  const publishedThumbnailUrl = useObjectUrl(data.publishedThumbnail);

  // A document deleted elsewhere has no checkbox to clear but would still be submitted, so drop it
  // and say so.
  useEffect(() => {
    if (!initialized || !documents.documents) return;
    const known = new Set(documents.documents.map((doc) => doc.id));
    const isKnown = (id: string) => known.has(id);
    if (values.docIds.every(isKnown)) return;
    const withoutUnknown = (current: DraftFormValues) => ({ ...current, docIds: current.docIds.filter(isKnown) });
    setValues(withoutUnknown);
    // The server dropped it from the saved draft too, so this isn't an edit to save.
    setSaved((current) => ({ ...current, values: withoutUnknown(current.values) }));
    showSnackbar(intl.formatMessage(messages.removedDocuments), 'warning');
  }, [initialized, documents.documents, values.docIds, intl, showSnackbar]);

  /** What to tell the user about a failed call; a vanished draft gets a clearer message than the server's. */
  const describeFailure = (error: unknown, fallback: string): string =>
    getErrorCode(error) === 'DRAFT_NOT_FOUND'
      ? intl.formatMessage(messages.draftNotFound)
      : getErrorMessage(error, fallback);

  if (data.isLoading || (!initialized && !data.error)) {
    return (
      <AppPage>
        <LoadingState label={intl.formatMessage(messages.loading)} />
      </AppPage>
    );
  }
  if (data.error || !data.server) {
    return (
      <AppPage>
        {data.error ? (
          <ErrorAlert error={data.error} onRetry={data.refetch} />
        ) : (
          <ErrorState message={intl.formatMessage(messages.loadFailed)} />
        )}
      </AppPage>
    );
  }

  const { server } = data;
  const isPublished = Boolean(publication);
  const canDeprecate = publication?.status === 'PUBLISHED';
  // Published is off the switch while there is nothing live, so an unpublish that lands
  // while the published version is on screen falls back to the draft.
  const pick = chosenView === 'published' && !isPublished ? undefined : chosenView;
  const view: PublicationVersionTone = pick ?? (isPublished ? 'published' : 'draft');
  const showingPublished = view === 'published';
  const hasUnsavedChanges =
    definitionText !== saved.definitionText ||
    assets.hasUnsavedChanges ||
    (Object.keys(values) as (keyof DraftFormValues)[]).some((field) => {
      const current = values[field];
      const savedValue = saved.values[field];
      return Array.isArray(current) && Array.isArray(savedValue)
        ? !sameSelection(current, savedValue)
        : current !== savedValue;
    });
  const errors = validateDraftFormValues(values);
  const errorFor = (field: DraftFormField) => {
    const error = touched[field] ? errors[field] : undefined;
    return error && intl.formatMessage(error);
  };
  const formInvalid = Object.keys(errors).length > 0;

  const markTouched = (field: DraftFormField) => setTouched((current) => ({ ...current, [field]: true }));

  const touchAllFields = () => setTouched(Object.fromEntries(FORM_FIELDS.map((field) => [field, true])));

  /** An edited field's message waits for its next blur, so it never flashes while the user is still typing. */
  const handleChange = (next: DraftFormValues) => {
    const edited = FORM_FIELDS.filter((field) => next[field] !== values[field]);
    setTouched((current) => ({ ...current, ...Object.fromEntries(edited.map((field) => [field, false])) }));
    setValues(next);
  };

  /** Saves the MCP Proxy Details fields alone. False, untouched, when the form itself is invalid. */
  const saveDetails = async (): Promise<boolean> => {
    if (formInvalid) {
      touchAllFields();
      setTab('details');
      return false;
    }
    await mcpProxiesApis.saveMcpProxyApiPortalDraft(
      apiPortalId,
      serverId,
      draftFormValuesToInput(values, draft ?? publication),
      PLATFORM_API_BASE_URL
    );
    setSaved((current) => ({ ...current, values }));
    return true;
  };

  /**
   * Saves the Capabilities definition alone. False, untouched, when its text is
   * not a JSON object (the tab says so) — a draft is a work in progress, so only
   * text that can't be sent at all is refused, and completeness is checked at publish.
   */
  const saveDefinition = async (): Promise<boolean> => {
    const parsed = parseDefinitionText(definitionText);
    if ('error' in parsed) {
      setTab('capabilities');
      return false;
    }
    await mcpProxiesApis.saveMcpProxyApiPortalDraftDefinition(
      apiPortalId,
      serverId,
      parsed.definition,
      PLATFORM_API_BASE_URL
    );
    setSaved((current) => ({ ...current, definitionText }));
    return true;
  };

  /**
   * Runs one action with its button shown busy, reporting a failure once. The page
   * is read again afterwards, unless `perform` returns true to say it left the page.
   */
  const runAction = async (action: PendingAction, failure: string, perform: () => Promise<boolean | void>) => {
    setPendingAction(action);
    let left = false;
    try {
      left = (await perform()) === true;
    } catch (error) {
      showSnackbar(describeFailure(error, failure), 'error');
    } finally {
      setPendingAction('idle');
      if (!left) data.refetch();
    }
  };

  const handleSaveDraft = () =>
    runAction('saving', intl.formatMessage(messages.saveFailed), async () => {
      if (!(await saveDetails())) return;
      const definitionSaved = await saveDefinition();
      await assets.saveThumbnail();
      showSnackbar(
        definitionSaved
          ? intl.formatMessage(messages.draftSaved)
          : intl.formatMessage(messages.detailsSavedOnly),
        definitionSaved ? 'success' : 'warning'
      );
    });

  /** Takes an image the user picked as the thumbnail, unless the server would refuse it. */
  const pickThumbnail = (file: File) => {
    const problem = validateThumbnailFile(file);
    if (problem) {
      showSnackbar(intl.formatMessage(problem), 'error');
      return;
    }
    assets.setThumbnail(file);
  };

  // Each terminal action leaves this one portal's page behind for the listing,
  // where the card now reflects the new status — there's nothing left to do
  // on this page once the action the user came here for has gone through.
  const backToPortalsList = () => navigate(portalsPath);

  const handlePublish = () =>
    runAction('publishing', intl.formatMessage(messages.publishFailed), async () => {
      if (!(await saveDetails())) return;
      // Publish requires a saved, parseable definition — never proceed on a
      // partial save, which would publish whatever definition was already
      // there rather than what the user is looking at.
      if (!(await saveDefinition())) return;
      await assets.saveThumbnail();
      try {
        await mcpProxiesApis.publishSavedMcpProxyDraft(apiPortalId, serverId, PLATFORM_API_BASE_URL);
      } catch (error) {
        // Sends the user to where they'd fix it; the message itself is reported by runAction.
        if (getErrorCode(error) === 'PUBLICATION_VALIDATION_FAILED' && tab !== 'documentations') setTab('capabilities');
        throw error;
      }
      showSnackbar(intl.formatMessage(messages.published, { portal: portalName }), 'success');
      backToPortalsList();
      return true;
    });

  const confirmUnpublish = () => {
    setConfirmingUnpublish(false);
    return runAction('unpublishing', intl.formatMessage(messages.unpublishFailed), async () => {
      await mcpProxiesApis.unpublishMcpProxyFromApiPortal(apiPortalId, serverId, PLATFORM_API_BASE_URL);
      showSnackbar(intl.formatMessage(messages.unpublished, { portal: portalName }), 'success');
      backToPortalsList();
      return true;
    });
  };

  const confirmDeprecate = () => {
    setConfirmingDeprecate(false);
    return runAction('deprecating', intl.formatMessage(messages.deprecateFailed), async () => {
      await mcpProxiesApis.deprecateMcpProxyOnApiPortal(apiPortalId, serverId, PLATFORM_API_BASE_URL);
      showSnackbar(intl.formatMessage(messages.deprecated, { portal: portalName }), 'success');
      backToPortalsList();
      return true;
    });
  };

  const publishedValues = resolveDraftFormValues(undefined, publication, undefined);

  // Only when it last changed: the switch already says which version this is, and the form shows its number.
  const draftBannerMeta = (): ReactNode => {
    if (!hasUnsavedChanges) {
      return (
        draft &&
        intl.formatMessage(messages.edited, { time: formatRelativeTime(draft.updatedAt) })
      );
    }
    return draft ? (
      <FormattedMessage {...messages.editedUnsaved} values={{ time: formatRelativeTime(draft.updatedAt), unsaved: unsavedChanges }} />
    ) : (
      unsavedChanges
    );
  };
  const draftMeta = draftBannerMeta();
  const banner = showingPublished
    ? {
        meta: canDeprecate
          ? intl.formatMessage(messages.updated, { time: formatRelativeTime(publication?.updatedAt) })
          : intl.formatMessage(messages.deprecatedAt, { time: formatRelativeTime(publication?.updatedAt) }),
      }
    : draftMeta
      ? { meta: draftMeta }
      : undefined;

  const renderContent = () => {
    if (showingPublished) {
      if (tab === 'documentations') {
        return (
          <DocumentsTab
            documents={documents.documents}
            failed={documents.failed}
            mcpProxyId={serverId}
            readOnly
            values={publishedValues}
          />
        );
      }
      return tab === 'details' ? (
        <McpProxyDetailsTab readOnly thumbnailUrl={publishedThumbnailUrl} values={publishedValues} />
      ) : data.publishedDefinition.isLoading ? (
        <LoadingState label={intl.formatMessage(messages.loadingPublishedSpec)} />
      ) : data.publishedDefinition.failed ? (
        <ErrorState message={intl.formatMessage(messages.publishedSpecFailed)} />
      ) : (
        <CapabilitiesTab readOnly text={definitionToText(data.publishedDefinition.definition)} />
      );
    }
    if (tab === 'documentations') {
      return (
        <DocumentsTab
          disabled={pendingAction !== 'idle'}
          documents={documents.documents}
          failed={documents.failed}
          mcpProxyId={serverId}
          onChange={handleChange}
          values={values}
        />
      );
    }
    return tab === 'details' ? (
      <McpProxyDetailsTab
        disabled={pendingAction !== 'idle'}
        errors={{
          displayName: errorFor('displayName'),
          version: errorFor('version'),
          productionUrl: errorFor('productionUrl'),
          sandboxUrl: errorFor('sandboxUrl'),
        }}
        onBlurField={markTouched}
        onChange={handleChange}
        onThumbnailPick={pickThumbnail}
        productionUrlOptions={data.productionUrlOptions}
        thumbnailUrl={thumbnailUrl}
        values={values}
      />
    ) : (
      <CapabilitiesTab
        available={server.capabilities as CapabilitiesTabProps['available']}
        disabled={pendingAction !== 'idle'}
        onChange={setDefinitionText}
        text={definitionText}
      />
    );
  };

  return (
    // Fills the screen, so the bottom gap is the control plane's rather than the default 64px that would shrink the card.
    <AppPage sx={{ pb: 5 }}>
      <Box ref={fill.ref} sx={{ display: 'flex', flexDirection: 'column', height: fill.height, minHeight: 0 }}>
        <Button
            component={Link}
            size="small"
            startIcon={<ChevronLeft size={24} />}
            sx={{ alignSelf: 'flex-start' }}
            to={portalsPath}
          >
            <FormattedMessage {...messages.back} />
          </Button>
        <PageTitle>
          <PageTitle.Header>
            <FormattedMessage {...messages.title} values={{ name: bold(server.displayName) }} />
          </PageTitle.Header>
          <PageTitle.SubHeader>
            <FormattedMessage {...messages.subtitle} values={{ portal: bold(portalName) }} />
          </PageTitle.SubHeader>
        </PageTitle>

        <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
          <Stack
            alignItems="flex-end"
            direction="row"
            justifyContent="space-between"
            sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
          >
            {/* Takes the row's spare width and scrolls within it, so the version toggle is never pushed off. */}
            <Tabs
              allowScrollButtonsMobile
              onChange={(_event, next: PublishTab) => setTab(next)}
              scrollButtons="auto"
              sx={{ flex: 1, minWidth: 0 }}
              value={tab}
              variant="scrollable"
            >
              <Tab label={intl.formatMessage(messages.tabDetails)} value="details" />
              <Tab label={intl.formatMessage(messages.tabCapabilities)} value="capabilities" />
              <Tab disabled label={intl.formatMessage(messages.tabPlans)} value="subscriptionPlans" />
              <Tab label={intl.formatMessage(messages.tabDocs)} value="documentations" />
              <Tab disabled label={intl.formatMessage(messages.tabLanding)} value="landingPage" />
            </Tabs>
            <PublicationVersionToggle
              disabled={pendingAction !== 'idle'}
              onChange={setChosenView}
              publishedAvailable={isPublished}
              value={view}
            />
          </Stack>

          <PublicationVersionCard banner={banner} tone={view}>
            {renderContent()}
          </PublicationVersionCard>

          {/* Reserves the bar's row while the published version is on screen, so the card doesn't resize. */}
          <Box sx={{ minHeight: ACTION_BAR_HEIGHT }}>
            {!showingPublished && (
              <PublishActionsBar
                canDeprecate={canDeprecate}
                canSaveDraft={hasUnsavedChanges}
                deprecating={pendingAction === 'deprecating'}
                isPublished={isPublished}
                onDeprecate={() => setConfirmingDeprecate(true)}
                onPublish={handlePublish}
                onSaveDraft={handleSaveDraft}
                onUnpublish={() => setConfirmingUnpublish(true)}
                permissions={{
                  publish: hasPermission(SCOPES.MCP_PROXY_API_PORTAL_PUBLISH),
                  unpublish: hasPermission(SCOPES.MCP_PROXY_API_PORTAL_UNPUBLISH),
                  deprecate: hasPermission(SCOPES.MCP_PROXY_API_PORTAL_DEPRECATE),
                }}
                publishing={pendingAction === 'publishing'}
                savingDraft={pendingAction === 'saving'}
                unpublishing={pendingAction === 'unpublishing'}
              />
            )}
          </Box>
        </Stack>
      </Box>

      <ConfirmDialog
        confirmInputLabel={intl.formatMessage(messages.typeToConfirm, { name: server.displayName })}
        confirmPhrase={server.displayName}
        destructive
        loading={pendingAction === 'unpublishing'}
        message={intl.formatMessage(messages.unpublishMessage, { name: server.displayName, portal: portalName })}
        onCancel={() => setConfirmingUnpublish(false)}
        onConfirm={confirmUnpublish}
        open={confirmingUnpublish}
        title={intl.formatMessage(messages.unpublishTitle)}
      />

      <ConfirmDialog
        confirmColor="warning"
        confirmInputLabel={intl.formatMessage(messages.typeToConfirm, { name: server.displayName })}
        confirmPhrase={server.displayName}
        loading={pendingAction === 'deprecating'}
        message={intl.formatMessage(messages.deprecateMessage, { name: server.displayName, portal: portalName })}
        onCancel={() => setConfirmingDeprecate(false)}
        onConfirm={confirmDeprecate}
        open={confirmingDeprecate}
        title={intl.formatMessage(messages.deprecateTitle)}
      />
    </AppPage>
  );
}
