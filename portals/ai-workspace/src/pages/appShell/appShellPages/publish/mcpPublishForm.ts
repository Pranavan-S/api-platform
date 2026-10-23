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

import { defineMessages, type MessageDescriptor } from 'react-intl';

import type { Gateway } from '../../../../apis/gatewayTypes';
import { buildMcpInvokeUrl } from '../../../../utils/mcpInvokeUrl';
import type {
  ApiPortalAgentVisibility,
  MCPServer,
  PublicationDetailsCore,
  PublicationDraftDetailsInput,
} from '../../../../utils/types';

/**
 * Form state and the pre-fill chain for the publish page: name, version,
 * description, the two endpoint URLs, agent visibility and the selected plans.
 * Tags, labels, owners and documents belong to parts this page does not show, so
 * a save carries over whatever the stored draft (or live listing) already holds
 * rather than clearing it.
 */

/** What the server stores for a listing that never set it; shown until the user chooses. */
const DEFAULT_AGENT_VISIBILITY: ApiPortalAgentVisibility = 'VISIBLE';

export type DraftFormValues = {
  displayName: string;
  version: string;
  description: string;
  productionUrl: string;
  sandboxUrl: string;
  agentVisibility: ApiPortalAgentVisibility;
  /** Handles of the subscription plans the listing offers. */
  subscriptionPlanIds: string[];
  /** Handles of the proxy's documents published with it. Not edited here, only carried. */
  docIds: string[];
};

export type DraftFormField = 'displayName' | 'version' | 'productionUrl' | 'sandboxUrl';

/** Each invalid field's message, to be formatted where it is shown. */
export type FormFieldErrors = Partial<Record<DraftFormField, MessageDescriptor>>;

export const publishFormMessages = defineMessages({
  nameRequired: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.form.nameRequired',
    defaultMessage: 'Enter a name.',
  },
  versionRequired: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.form.versionRequired',
    defaultMessage: 'Enter a version.',
  },
  urlInvalid: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.form.urlInvalid',
    defaultMessage: 'Enter a full URL, for example https://mcp.example.com.',
  },
  definitionInvalidJson: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.form.definitionInvalidJson',
    defaultMessage: 'This is not valid JSON: {detail}',
  },
  definitionNotObject: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.form.definitionNotObject',
    defaultMessage: 'The definition must be a JSON object.',
  },
});

/** A URL the Production URL can be picked from, and the gateway that serves it. */
export type GatewayUrlOption = { gatewayName: string; url: string };

/** What a draft or the live listing holds, as far as the form is concerned. */
type StoredPublication = Partial<PublicationDetailsCore> &
  Pick<PublicationDraftDetailsInput, 'subscriptionPlanIds' | 'docIds'>;

export const emptyDraftFormValues: DraftFormValues = {
  displayName: '',
  version: '',
  description: '',
  productionUrl: '',
  sandboxUrl: '',
  agentVisibility: DEFAULT_AGENT_VISIBILITY,
  subscriptionPlanIds: [],
  docIds: [],
};

/** The URLs the proxy is served at: one per gateway it is deployed to, newest deployment first. */
export const buildProductionUrlOptions = (
  gateways: readonly Gateway[],
  context: string | undefined
): GatewayUrlOption[] =>
  gateways
    .map((gateway) => ({
      gatewayName: gateway.displayName || gateway.name,
      url: buildMcpInvokeUrl(gateway, context),
    }))
    .filter((option) => option.url !== '');

const fromStored = (stored: StoredPublication): DraftFormValues => ({
  displayName: stored.displayName ?? '',
  version: stored.version ?? '',
  description: stored.description ?? '',
  productionUrl: stored.endpoints?.productionUrl ?? '',
  sandboxUrl: stored.endpoints?.sandboxUrl ?? '',
  agentVisibility: stored.agentVisibility ?? DEFAULT_AGENT_VISIBILITY,
  subscriptionPlanIds: stored.subscriptionPlanIds ?? [],
  docIds: stored.docIds ?? [],
});

/**
 * The read chain, only for pre-filling the form: draft, then publication, then
 * the proxy's own fields — starting from the most recent edit, published or
 * not. The proxy's tier defaults the Production URL to `defaultProductionUrl`,
 * a gateway URL, and leaves it empty without one.
 */
export const resolveDraftFormValues = (
  draft: StoredPublication | undefined,
  publication: StoredPublication | undefined,
  server: Pick<MCPServer, 'displayName' | 'version' | 'description'> | undefined,
  defaultProductionUrl?: string
): DraftFormValues => {
  if (draft) return fromStored(draft);
  if (publication) return fromStored(publication);
  if (server) {
    return {
      ...emptyDraftFormValues,
      displayName: server.displayName ?? '',
      version: server.version ?? '',
      description: server.description ?? '',
      productionUrl: defaultProductionUrl ?? '',
      subscriptionPlanIds: [],
      docIds: [],
    };
  }
  return emptyDraftFormValues;
};

/** A selection is a set: the server ignores order, and an item toggled off and on moves to the end. */
export const sameSelection = (a: string[], b: string[]): boolean => {
  const members = new Set(a);
  return members.size === new Set(b).size && b.every((id) => members.has(id));
};

const trimmedOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * The PUT body for `.../draft`. A draft save replaces everything, so the fields
 * this form does not show are carried over from `stored`; the read-only audit
 * and asset fields it also holds are left out. Empty strings are sent as
 * `undefined`, so an untouched field reads back as unset. The plan and document
 * selections are always sent, even as `[]`, since leaving one out would clear it.
 */
export const draftFormValuesToInput = (
  values: DraftFormValues,
  stored?: StoredPublication
): PublicationDraftDetailsInput => {
  const productionUrl = trimmedOrUndefined(values.productionUrl);
  const sandboxUrl = trimmedOrUndefined(values.sandboxUrl);
  return {
    displayName: values.displayName.trim(),
    version: values.version.trim(),
    description: trimmedOrUndefined(values.description),
    agentVisibility: values.agentVisibility,
    ...((productionUrl ?? sandboxUrl) !== undefined ? { endpoints: { productionUrl, sandboxUrl } } : {}),
    tags: stored?.tags,
    labels: stored?.labels,
    owners: stored?.owners,
    subscriptionPlanIds: values.subscriptionPlanIds,
    docIds: values.docIds,
  };
};

const isHttpUrl = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * `displayName`/`version` are the schema's own required fields; the two URLs are
 * optional but, when given, have to be full URLs.
 */
export const validateDraftFormValues = (values: DraftFormValues): FormFieldErrors => {
  const errors: FormFieldErrors = {};
  if (values.displayName.trim() === '') errors.displayName = publishFormMessages.nameRequired;
  if (values.version.trim() === '') errors.version = publishFormMessages.versionRequired;

  const urlMessage = publishFormMessages.urlInvalid;
  const productionUrl = values.productionUrl.trim();
  if (productionUrl !== '' && !isHttpUrl(productionUrl)) errors.productionUrl = urlMessage;
  const sandboxUrl = values.sandboxUrl.trim();
  if (sandboxUrl !== '' && !isHttpUrl(sandboxUrl)) errors.sandboxUrl = urlMessage;
  return errors;
};

/** What the listing advertises: tools, resources and prompts, and anything else the server keeps with them. */
export type McpDefinition = Record<string, unknown>;

/** The definition as JSON text, with the three lists always present and first; other fields follow untouched. */
export const definitionToText = (definition: McpDefinition | undefined): string => {
  const { tools = [], resources = [], prompts = [], ...rest } = definition ?? {};
  return JSON.stringify({ tools, resources, prompts, ...rest }, null, 2);
};

/** Why the definition's text could not be read, to be formatted where it is shown. */
export type DefinitionError = { message: MessageDescriptor; values?: { detail: string } };

export type ParsedDefinition = { definition: Record<string, unknown> } | { error: DefinitionError };

/**
 * Reads the definition's text into the object the server expects. A draft is a work
 * in progress — whether it is a complete definition is checked at publish — so
 * this only refuses text that is not a JSON object at all.
 */
export const parseDefinitionText = (text: string): ParsedDefinition => {
  if (text.trim() === '') return { definition: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      error: {
        message: publishFormMessages.definitionInvalidJson,
        values: { detail: error instanceof Error ? error.message : String(error) },
      },
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: { message: publishFormMessages.definitionNotObject } };
  }
  return { definition: parsed as Record<string, unknown> };
};

/**
 * The monogram shown for a name: its first two letters, not word initials —
 * "Travel MCP" reads as `TR`, which is easier to match back to the title.
 */
export const nameInitials = (name: string): string =>
  name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase();
