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

import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import {
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  IconButton,
  ListingTable,
  Stack,
  type Theme,
  Typography,
} from '@wso2/oxygen-ui';
import { FileSearch, Minus, Plus, X } from '@wso2/oxygen-ui-icons-react';

import type { MCPProxyDocument } from '../../../../utils/types';
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
  columnName: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.columnName',
    defaultMessage: 'Name',
  },
  columnType: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.columnType',
    defaultMessage: 'Type',
  },
  columnActions: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.columnActions',
    defaultMessage: 'Actions',
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

// Cancels a control's own left padding so its content starts under the column heading.
const TYPE_CHIP_OFFSET = '-9px'; // outlined small chip: 1px border + 8px label padding
const PREVIEW_BUTTON_OFFSET = -0.625; // small text button: 5px side padding

const selectedRowSx = (theme: Theme) => ({
  '&.Mui-selected, &.Mui-selected:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
});

export type DocumentsTabProps = {
  disabled?: boolean;
  /** The proxy's documents; `undefined` while they load. */
  documents?: MCPProxyDocument[];
  /** The documents could not be read. */
  failed?: boolean;
  mcpProxyId: string;
  /** Called with every change; never when `readOnly`. */
  onChange?: (values: DraftFormValues) => void;
  /** Lists exactly the documents the values select, without checkboxes. */
  readOnly?: boolean;
  values: DraftFormValues;
};

/**
 * "Documentation": which of the proxy's documents are published with it, as a table of name and
 * type ordered by type.
 *
 * The draft adds a select column (select all in its header) and an Actions column whose Preview
 * button opens the document's content. The published view lists exactly the documents the live
 * listing holds, with neither.
 */
export function DocumentsTab({ disabled, documents, failed, mcpProxyId, onChange, readOnly, values }: DocumentsTabProps) {
  const intl = useIntl();
  const [previewId, setPreviewId] = useState<string>();

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

  const rows = groupDocumentsByType(shown, intl).flatMap((group) =>
    group.items.map((doc) => ({ doc, typeLabel: group.label }))
  );
  const selectedCount = documents.filter((doc) => selected.has(doc.id)).length;
  const allSelected = selectedCount === documents.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const previewed = documents.find((doc) => doc.id === previewId);

  const toggle = (docId: string) =>
    onChange?.({
      ...values,
      docIds: selected.has(docId) ? values.docIds.filter((id) => id !== docId) : [...values.docIds, docId],
    });

  const toggleAll = () => onChange?.({ ...values, docIds: allSelected ? [] : documents.map((doc) => doc.id) });

  // Same summary row as the Subscription Plans tab.
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
      </Box>

      <ListingTable.Provider>
        <ListingTable.Container>
          {/* Type 35% and Actions 15% of the row; Name takes the rest and truncates. */}
          <ListingTable sx={{ minWidth: 640, tableLayout: 'fixed' }}>
            <ListingTable.Head>
              <ListingTable.Row>
                {!readOnly && (
                  <ListingTable.Cell padding="checkbox" sx={{ width: 48 }}>
                    <Checkbox
                      checked={allSelected}
                      disabled={disabled}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                      slotProps={{
                        input: { 'aria-label': intl.formatMessage(allSelected ? messages.clearAll : messages.selectAll) },
                      }}
                    />
                  </ListingTable.Cell>
                )}
                <ListingTable.Cell>
                  <FormattedMessage {...messages.columnName} />
                </ListingTable.Cell>
                <ListingTable.Cell sx={{ width: '35%' }}>
                  <FormattedMessage {...messages.columnType} />
                </ListingTable.Cell>
                {!readOnly && (
                  <ListingTable.Cell sx={{ width: '15%' }}>
                    <FormattedMessage {...messages.columnActions} />
                  </ListingTable.Cell>
                )}
              </ListingTable.Row>
            </ListingTable.Head>
            <ListingTable.Body>
              {rows.map(({ doc, typeLabel }) => {
                const isSelected = selected.has(doc.id);
                return (
                  <ListingTable.Row key={doc.id} selected={!readOnly && isSelected} sx={selectedRowSx}>
                    {!readOnly && (
                      <ListingTable.Cell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => toggle(doc.id)}
                          slotProps={{ input: { 'aria-label': doc.displayName } }}
                        />
                      </ListingTable.Cell>
                    )}
                    <ListingTable.Cell truncate>
                      <Typography noWrap variant="body2">
                        {doc.displayName}
                      </Typography>
                    </ListingTable.Cell>
                    <ListingTable.Cell>
                      <Chip label={typeLabel} size="small" sx={{ ml: TYPE_CHIP_OFFSET }} variant="outlined" />
                    </ListingTable.Cell>
                    {!readOnly && (
                      <ListingTable.Cell>
                        <Button
                          aria-label={intl.formatMessage(messages.previewDocument, { name: doc.displayName })}
                          onClick={() => setPreviewId(doc.id)}
                          size="small"
                          startIcon={<FileSearch size={16} />}
                          sx={{ ml: PREVIEW_BUTTON_OFFSET, whiteSpace: 'nowrap' }}
                          variant="text"
                        >
                          <FormattedMessage {...messages.preview} />
                        </Button>
                      </ListingTable.Cell>
                    )}
                  </ListingTable.Row>
                );
              })}
            </ListingTable.Body>
          </ListingTable>
        </ListingTable.Container>
      </ListingTable.Provider>

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
