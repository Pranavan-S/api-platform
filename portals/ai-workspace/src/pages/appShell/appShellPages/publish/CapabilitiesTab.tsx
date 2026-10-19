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

import { useMemo, useState, type MouseEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Checkbox,
  Chip,
  Stack,
  Tooltip,
  Typography,
} from '@wso2/oxygen-ui';
import { ChevronDown } from '@wso2/oxygen-ui-icons-react';
import {
  CAPABILITY_KINDS,
  capabilityRows,
  definitionToJson,
  setAllCapabilities,
  toggleCapability,
  type CapabilityItem,
  type CapabilityKind,
  type CapabilityRow,
} from './mcpCapabilitySelection';
import { parseDefinitionText } from './mcpPublishForm';

const messages = defineMessages({
  notOnProxy: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.notOnProxy',
    defaultMessage: 'Not on this MCP proxy',
  },
  selectAll: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.selectAll',
    defaultMessage: 'Select all {kind}',
  },
  selectedCount: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.selectedCount',
    defaultMessage: 'Selected: {selected} of {total}',
  },
  total: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.total',
    defaultMessage: 'Total: {total}',
  },
  intro: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.intro',
    defaultMessage: 'Choose the tools, resources and prompts of this MCP proxy to list on the MCP Hub.',
  },
  emptyEditable: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.emptyEditable',
    defaultMessage: 'This MCP proxy has no tools, resources or prompts to list. Add them from the MCP proxy\'s Overview page.',
  },
  emptyReadOnly: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.emptyReadOnly',
    defaultMessage: 'This version lists no tools, resources or prompts.',
  },
});

export type CapabilitiesTabProps = {
  /** What the MCP proxy itself offers, to pick from. */
  available?: Partial<Record<CapabilityKind, CapabilityItem[]>>;
  disabled?: boolean;
  /** Every change, as the definition's full JSON text. Never called when `readOnly`. */
  onChange?: (text: string) => void;
  /** Lists what the definition holds without letting it be changed, for a version that can't be. */
  readOnly?: boolean;
  /** The definition's raw JSON text. */
  text: string;
};

const TITLE: Record<CapabilityKind, { id: string; defaultMessage: string }> = {
  tools: { id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.tools', defaultMessage: 'Tools' },
  resources: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.resources',
    defaultMessage: 'Resources',
  },
  prompts: { id: 'aiWorkspace.pages.appShell.appShellPages.publish.capabilities.prompts', defaultMessage: 'Prompts' },
};

const DESCRIPTION_LINES = 2;

const rowSx = {
  alignItems: 'flex-start',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  display: 'flex',
  gap: 0.5,
  minHeight: 52,
  pl: 0.5,
  pr: 1.5,
  py: 0.5,
} as const;

const titleOf = (item: CapabilityItem): string => {
  const name = item.name;
  if (typeof name === 'string' && name !== '') return name;
  return typeof item.uri === 'string' ? item.uri : '';
};

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * A description cut to its first lines, with the whole of it in a tooltip once it
 * has been cut. Whether it was is only known after layout, so it is measured when
 * the pointer arrives rather than guessed from the text's length.
 */
function ClampedText({ children }: { children: string }) {
  const [cut, setCut] = useState(false);
  return (
    <Tooltip arrow disableHoverListener={!cut} placement="top-start" title={children}>
      <Typography
        color="text.secondary"
        onMouseEnter={(event) => setCut(event.currentTarget.scrollHeight > event.currentTarget.clientHeight)}
        sx={{
          display: '-webkit-box',
          overflow: 'hidden',
          overflowWrap: 'anywhere',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: DESCRIPTION_LINES,
        }}
        variant="body2"
      >
        {children}
      </Typography>
    </Tooltip>
  );
}

type RowProps = {
  disabled?: boolean;
  kind: CapabilityKind;
  /** Without a handler the row has no checkbox: it only lists. */
  onToggle?: () => void;
  row: CapabilityRow;
};

function CapabilityListRow({ disabled, kind, onToggle, row }: RowProps) {
  const intl = useIntl();
  const title = titleOf(row.item);
  const uri = kind === 'resources' && row.item.name ? textOf(row.item.uri) : '';
  const description = textOf(row.item.description);

  return (
    <Box
      onClick={disabled ? undefined : onToggle}
      sx={{ ...rowSx, cursor: onToggle && !disabled ? 'pointer' : 'default' }}
    >
      {onToggle && (
        <Checkbox
          checked={row.selected}
          disabled={disabled}
          inputProps={{ 'aria-label': title }}
          onChange={onToggle}
          onClick={(event: MouseEvent) => event.stopPropagation()}
        />
      )}
      <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0, ml: onToggle ? 0 : 1, py: 0.75 }}>
        <Stack alignItems="center" direction="row" spacing={1}>
          <Typography noWrap sx={{ fontWeight: 600, minWidth: 0 }} variant="subtitle2">
            {title}
          </Typography>
          {!row.onProxy && (
            <Chip
              label={intl.formatMessage(messages.notOnProxy)}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
        {uri && (
          <Typography color="text.secondary" noWrap variant="caption">
            {uri}
          </Typography>
        )}
        {description && <ClampedText>{description}</ClampedText>}
      </Stack>
    </Box>
  );
}

/**
 * "Capabilities" — which of the MCP proxy's tools, resources and prompts the
 * listing advertises (`.../draft/definition`). They are shown as the proxy
 * overview shows them, a section for each kind, but with a checkbox on every
 * item and its description beside it, cut after two lines; the definition JSON behind them is written for the user and saved with
 * the rest of the draft, so there is no Save here. A version that can't be
 * changed lists only what it holds.
 */
export function CapabilitiesTab({ available = {}, disabled, onChange, readOnly, text }: CapabilitiesTabProps) {
  const intl = useIntl();
  const parsed = useMemo(() => parseDefinitionText(text), [text]);
  const definition = 'definition' in parsed ? parsed.definition : undefined;
  const editable = !readOnly;

  const sections = definition
    ? CAPABILITY_KINDS.map((kind) => {
        const items = editable ? (available[kind] ?? []) : [];
        return { kind, items, rows: capabilityRows(kind, items, definition) };
      }).filter(({ rows }) => rows.length > 0)
    : [];

  const change = (next: Record<string, unknown>) => onChange?.(definitionToJson(next));

  return (
    <Box component="section" sx={{ p: 3 }}>
      <Stack spacing={2}>
        {'error' in parsed && (
          <Alert severity="error">{intl.formatMessage(parsed.error.message, parsed.error.values)}</Alert>
        )}

        {editable && (
          <Typography color="text.secondary" variant="body2">
            <FormattedMessage {...messages.intro} />
          </Typography>
        )}

        {definition && sections.length === 0 && (
          <Typography color="text.secondary" variant="body2">
            {editable ? (
              <FormattedMessage {...messages.emptyEditable} />
            ) : (
              <FormattedMessage {...messages.emptyReadOnly} />
            )}
          </Typography>
        )}

        {definition &&
          sections.map(({ kind, items, rows }) => {
            const selectedCount = rows.filter((row) => row.selected).length;
            const allSelected = selectedCount === rows.length;
            return (
              <Accordion key={kind} sx={{ '&:before': { display: 'none' }, borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ChevronDown size={18} />}>
                  <Stack alignItems="center" direction="row" spacing={1}>
                    {editable && (
                      <Checkbox
                        checked={allSelected}
                        disabled={disabled}
                        indeterminate={selectedCount > 0 && !allSelected}
                        inputProps={{
                          'aria-label': intl.formatMessage(messages.selectAll, { kind: intl.formatMessage(TITLE[kind]).toLowerCase() }),
                        }}
                        onChange={() => change(setAllCapabilities(definition, kind, items, !allSelected))}
                        onClick={(event: MouseEvent) => event.stopPropagation()}
                        sx={{ ml: -1 }}
                      />
                    )}
                    <Typography sx={{ fontWeight: 600 }}>{intl.formatMessage(TITLE[kind])}</Typography>
                    <Chip
                      color="primary"
                      label={
                        editable
                          ? intl.formatMessage(messages.selectedCount, { selected: selectedCount, total: rows.length })
                          : intl.formatMessage(messages.total, { total: rows.length })
                      }
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.5}>
                    {rows.map((row) => (
                      <CapabilityListRow
                        disabled={disabled}
                        key={row.key}
                        kind={kind}
                        onToggle={editable ? () => change(toggleCapability(definition, kind, items, row.key)) : undefined}
                        row={row}
                      />
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })}
      </Stack>
    </Box>
  );
}
