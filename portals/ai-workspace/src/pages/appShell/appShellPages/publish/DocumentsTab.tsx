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

import { Fragment, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@wso2/oxygen-ui';
import { FileSearch, FileText, Minus, Plus, X } from '@wso2/oxygen-ui-icons-react';
import type { MCPProxyDocument } from '../../../../utils/types';
import { DocumentGroupHeader } from './DocumentGroupHeader';
import { groupDocumentsByType } from './documentGroups';
import { DocumentPreview } from './DocumentPreview';
import type { DraftFormValues } from './mcpPublishForm';
import { EmptyState, ErrorState, LoadingState } from './PublishStates';

const messages = defineMessages({
  loading: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.loading',
    defaultMessage: 'Loading documents',
  },
  error: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.error',
    defaultMessage: 'Unable to load documents.',
  },
  emptyTitle: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.emptyTitle',
    defaultMessage: 'No documents',
  },
  emptyDescription: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.emptyDescription',
    defaultMessage: 'This MCP proxy has no documents to choose from.',
  },
  publishedEmptyTitle: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.publishedEmptyTitle',
    defaultMessage: 'This listing has no documents.',
  },
  selectedSummary: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.selectedSummary',
    defaultMessage: '{count} of {total} documents selected',
    description: '{count} is a styled number rendered as a React element, not plain text; {total} is a plain number.',
  },
  publishedSummary: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.publishedSummary',
    defaultMessage: '{count, plural, one {<n>#</n> document published} other {<n>#</n> documents published}}',
    description: '<n> wraps the number, which is styled.',
  },
  selectAll: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.selectAll',
    defaultMessage: 'Select all',
  },
  clearAll: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.clearAll',
    defaultMessage: 'Clear all',
  },
  preview: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.preview',
    defaultMessage: 'Preview',
  },
  previewDocument: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.previewDocument',
    defaultMessage: 'Preview {name}',
    description: "Accessible name of the button that opens a document's content; {name} is the document's name.",
  },
  addToListing: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.addToListing',
    defaultMessage: 'Add to listing',
  },
  removeFromListing: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.removeFromListing',
    defaultMessage: 'Remove from listing',
  },
  closePreview: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.closePreview',
    defaultMessage: 'Close',
  },
});

const PREVIEW_WIDTH = 520;

export type DocumentsTabProps = {
  disabled?: boolean;
  /** The proxy's documents; `undefined` while they load. */
  documents?: MCPProxyDocument[];
  /** The documents could not be read. */
  failed?: boolean;
  mcpProxyId: string;
  /** Called with every change; never when `readOnly`. */
  onChange?: (values: DraftFormValues) => void;
  /** Lists exactly the documents the values select, without checkboxes or preview. */
  readOnly?: boolean;
  values: DraftFormValues;
};

/**
 * "Documentation": which of the proxy's documents are published with it.
 *
 * The draft lists every document with a checkbox and a Preview button that opens its
 * content. The published view lists exactly the documents the live listing holds.
 */
export function DocumentsTab({ disabled, documents, failed, mcpProxyId, onChange, readOnly, values }: DocumentsTabProps) {
  const intl = useIntl();
  const [previewId, setPreviewId] = useState<string>();
  // Collapsed groups, by type.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  if (failed) return <ErrorState message={intl.formatMessage(messages.error)} />;
  if (!documents) return <LoadingState label={intl.formatMessage(messages.loading)} />;

  const selected = new Set(values.docIds);
  const shown = readOnly ? documents.filter((doc) => selected.has(doc.id)) : documents;
  if (shown.length === 0) {
    return (
      <Box component="section" sx={{ p: 3 }}>
        <EmptyState
          description={readOnly ? undefined : intl.formatMessage(messages.emptyDescription)}
          title={intl.formatMessage(readOnly ? messages.publishedEmptyTitle : messages.emptyTitle)}
        />
      </Box>
    );
  }

  const groups = groupDocumentsByType(shown, intl);
  const selectedCount = documents.filter((doc) => selected.has(doc.id)).length;
  const allSelected = selectedCount === documents.length;
  const previewed = documents.find((doc) => doc.id === previewId);

  const commitSelection = (docIds: string[]) => onChange?.({ ...values, docIds });

  const toggle = (docId: string) =>
    commitSelection(selected.has(docId) ? values.docIds.filter((id) => id !== docId) : [...values.docIds, docId]);

  const toggleAll = () => commitSelection(allSelected ? [] : documents.map((doc) => doc.id));

  const toggleGroup = (type: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const countSx = { color: readOnly ? 'success.main' : 'primary.main', fontSize: 20, fontWeight: 500 } as const;

  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3 }}>
      <Box sx={{ alignItems: 'center', display: 'flex', gap: 2, justifyContent: 'space-between', minHeight: 32 }}>
        <Typography color="text.secondary" variant="body2">
          {readOnly ? (
            <FormattedMessage
              {...messages.publishedSummary}
              values={{
                count: shown.length,
                n: (chunks) => (
                  <Typography component="span" sx={countSx}>
                    {chunks}
                  </Typography>
                ),
              }}
            />
          ) : (
            <FormattedMessage
              {...messages.selectedSummary}
              values={{
                count: (
                  <Typography component="span" sx={countSx}>
                    {selectedCount}
                  </Typography>
                ),
                total: documents.length,
              }}
            />
          )}
        </Typography>
        {!readOnly && (
          <Button disabled={disabled} onClick={toggleAll} size="small" variant="text">
            <FormattedMessage {...(allSelected ? messages.clearAll : messages.selectAll)} />
          </Button>
        )}
      </Box>

      <List dense disablePadding>
        {groups.map((group, groupIndex) => {
          const open = !collapsed.has(group.type);
          return (
            <Fragment key={group.type}>
              <DocumentGroupHeader
                controlsId={`document-group-\${group.type}`}
                count={group.items.length}
                first={groupIndex === 0}
                label={group.label}
                onToggle={() => toggleGroup(group.type)}
                open={open}
              />
              <Collapse id={`document-group-\${group.type}`} in={open} timeout="auto">
                {group.items.map((doc) => (
                  <DocumentRow
                    disabled={disabled}
                    doc={doc}
                    key={doc.id}
                    onPreview={() => setPreviewId(doc.id)}
                    onToggle={() => toggle(doc.id)}
                    readOnly={readOnly}
                    selected={selected.has(doc.id)}
                  />
                ))}
              </Collapse>
            </Fragment>
          );
        })}
      </List>

      <Drawer
        anchor="right"
        onClose={() => setPreviewId(undefined)}
        open={Boolean(previewed)}
        slotProps={{ paper: { sx: { maxWidth: '100%', width: PREVIEW_WIDTH } } }}
      >
        {previewed && (
          <>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
              <Typography component="h2" noWrap sx={{ flex: 1, fontWeight: 600 }} variant="h6">
                {previewed.displayName}
              </Typography>
              <IconButton
                aria-label={intl.formatMessage(messages.closePreview)}
                onClick={() => setPreviewId(undefined)}
                size="small"
              >
                <X size={18} />
              </IconButton>
            </Stack>
            <Divider />
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
              <DocumentPreview docId={previewed.id} key={previewed.id} mcpProxyId={mcpProxyId} />
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
              <Button
                color={selected.has(previewed.id) ? 'inherit' : 'primary'}
                disabled={disabled}
                onClick={() => toggle(previewed.id)}
                startIcon={selected.has(previewed.id) ? <Minus size={16} /> : <Plus size={16} />}
                variant={selected.has(previewed.id) ? 'outlined' : 'contained'}
              >
                <FormattedMessage
                  {...(selected.has(previewed.id) ? messages.removeFromListing : messages.addToListing)}
                />
              </Button>
            </Box>
          </>
        )}
      </Drawer>
    </Box>
  );
}

type DocumentRowProps = {
  disabled?: boolean;
  doc: MCPProxyDocument;
  onPreview: () => void;
  onToggle: () => void;
  readOnly?: boolean;
  selected: boolean;
};

/** One document: its checkbox, name and type, and a button that opens its content. */
function DocumentRow({ disabled, doc, onPreview, onToggle, readOnly, selected }: DocumentRowProps) {
  const intl = useIntl();
  if (readOnly) {
    return (
      <ListItem component="div" dense>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <FileText size={16} />
        </ListItemIcon>
        <ListItemText primary={doc.displayName} slotProps={{ primary: { noWrap: true } }} />
      </ListItem>
    );
  }
  return (
    <Stack
      direction="row"
      sx={(theme) => ({
        alignItems: 'center',
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : undefined,
        borderRadius: 1,
        gap: 1,
        mb: 0.5,
        pr: 1,
      })}
    >
      <Checkbox
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        slotProps={{ input: { 'aria-label': doc.displayName } }}
      />
      <ListItemText primary={doc.displayName} slotProps={{ primary: { noWrap: true } }} sx={{ flex: 1, minWidth: 0 }} />
      <Button
        aria-label={intl.formatMessage(messages.previewDocument, { name: doc.displayName })}
        onClick={onPreview}
        size="small"
        startIcon={<FileSearch size={16} />}
        variant="text"
      >
        <FormattedMessage {...messages.preview} />
      </Button>
    </Stack>
  );
}
