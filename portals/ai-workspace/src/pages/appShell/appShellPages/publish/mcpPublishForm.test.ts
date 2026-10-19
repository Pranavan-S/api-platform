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
import type { Gateway } from '../../../../apis/gatewayTypes';
import type { PublicationDraftDetails } from '../../../../utils/types';
import {
  buildProductionUrlOptions,
  definitionToText,
  draftFormValuesToInput,
  nameInitials,
  parseDefinitionText,
  publishFormMessages,
  resolveDraftFormValues,
  validateDraftFormValues,
  type DraftFormValues,
} from './mcpPublishForm';
import { buildViewInPortalUrl, isListedOnPortal, publicationStatusMeta } from './publicationDisplay';

const server = { displayName: 'Travel MCP', version: 'v1', description: 'Trip planning tools' };

const baseValues: DraftFormValues = {
  displayName: 'Travel MCP',
  version: 'v1',
  description: '',
  productionUrl: '',
  sandboxUrl: '',
  agentVisibility: 'VISIBLE',
};

describe('buildProductionUrlOptions', () => {
  it('offers one URL per gateway and skips gateways without a host', () => {
    const gateways = [
      { name: 'a', displayName: 'Gateway A', endpoints: ['a.example.com'] },
      { name: 'b', displayName: 'Gateway B' },
    ] as Gateway[];
    expect(buildProductionUrlOptions(gateways, '/t')).toEqual([
      { gatewayName: 'Gateway A', url: 'https://a.example.com/t/mcp' },
    ]);
  });
});

describe('resolveDraftFormValues', () => {
  it('seeds from the proxy, with the gateway URL as the default production URL', () => {
    expect(resolveDraftFormValues(undefined, undefined, server, 'https://gw/mcp')).toEqual({
      displayName: 'Travel MCP',
      version: 'v1',
      description: 'Trip planning tools',
      productionUrl: 'https://gw/mcp',
      sandboxUrl: '',
      agentVisibility: 'VISIBLE',
    });
  });

  it('prefers the draft, then the live listing, over the proxy', () => {
    const draft: PublicationDraftDetails = {
      displayName: 'Draft name',
      version: '2',
      agentVisibility: 'HIDDEN',
      endpoints: { productionUrl: 'https://draft/mcp' },
    };
    expect(resolveDraftFormValues(draft, { displayName: 'Live' }, server)).toMatchObject({
      displayName: 'Draft name',
      agentVisibility: 'HIDDEN',
      productionUrl: 'https://draft/mcp',
    });
    expect(resolveDraftFormValues(undefined, { displayName: 'Live', version: '1' }, server).displayName).toBe('Live');
  });
});

describe('validateDraftFormValues', () => {
  it('accepts a minimal form', () => {
    expect(validateDraftFormValues(baseValues)).toEqual({});
  });

  it('requires a name and version', () => {
    const errors = validateDraftFormValues({ ...baseValues, displayName: ' ', version: '' });
    expect(errors.displayName).toBe(publishFormMessages.nameRequired);
    expect(errors.version).toBe(publishFormMessages.versionRequired);
  });

  it('rejects non-http(s) and malformed URLs', () => {
    expect(validateDraftFormValues({ ...baseValues, productionUrl: 'ftp://x' }).productionUrl).toBeDefined();
    expect(validateDraftFormValues({ ...baseValues, sandboxUrl: 'not a url' }).sandboxUrl).toBeDefined();
    expect(validateDraftFormValues({ ...baseValues, productionUrl: 'https://gw/mcp' })).toEqual({});
  });
});

describe('draftFormValuesToInput', () => {
  it('omits empty optional fields', () => {
    const input = draftFormValuesToInput(baseValues);
    expect(input.endpoints).toBeUndefined();
    expect(input.description).toBeUndefined();
  });

  it('trims and sends the endpoints that are set', () => {
    const input = draftFormValuesToInput({ ...baseValues, productionUrl: ' https://gw/mcp ' });
    expect(input.endpoints).toEqual({ productionUrl: 'https://gw/mcp', sandboxUrl: undefined });
  });

  it('carries over what the form does not show and drops audit fields', () => {
    const stored: PublicationDraftDetails = {
      displayName: 'x',
      version: '1',
      tags: ['ai'],
      labels: ['default'],
      owners: { businessOwner: 'Pat' },
      subscriptionPlanIds: ['gold'],
      docIds: ['guide'],
      createdBy: 'someone',
      hasThumbnail: true,
    };
    const input = draftFormValuesToInput(baseValues, stored);
    expect(input).toMatchObject({
      tags: ['ai'],
      labels: ['default'],
      owners: { businessOwner: 'Pat' },
      subscriptionPlanIds: ['gold'],
      docIds: ['guide'],
    });
    expect(input).not.toHaveProperty('createdBy');
    expect(input).not.toHaveProperty('hasThumbnail');
  });
});

describe('definition text', () => {
  it('always prints the three arrays', () => {
    expect(JSON.parse(definitionToText(undefined))).toEqual({ tools: [], resources: [], prompts: [] });
    expect(JSON.parse(definitionToText({ tools: [{ name: 't' }] }))).toMatchObject({ tools: [{ name: 't' }] });
    expect(Object.keys(JSON.parse(definitionToText({ extra: 1, prompts: [] })))).toEqual([
      'tools',
      'resources',
      'prompts',
      'extra',
    ]);
  });

  it('parses a JSON object and treats blank text as empty', () => {
    expect(parseDefinitionText('{"tools":[]}')).toEqual({ definition: { tools: [] } });
    expect(parseDefinitionText('  ')).toEqual({ definition: {} });
  });

  it('refuses text that is not a JSON object', () => {
    expect('error' in parseDefinitionText('{oops')).toBe(true);
    const notObject = { error: { message: publishFormMessages.definitionNotObject } };
    expect(parseDefinitionText('[]')).toEqual(notObject);
    expect(parseDefinitionText('null')).toEqual(notObject);
  });
});

describe('nameInitials', () => {
  it('takes the first two letters of the name, ignoring punctuation and spaces', () => {
    expect(nameInitials('Travel')).toBe('TR');
    expect(nameInitials('Travel MCP Server')).toBe('TR');
    expect(nameInitials('  -x y')).toBe('XY');
    expect(nameInitials('  ')).toBe('');
  });
});

describe('publication display', () => {
  it('maps status to chip, with unknown meaning not published', () => {
    const label = (status: Parameters<typeof publicationStatusMeta>[0]) =>
      publicationStatusMeta(status).label.defaultMessage;
    expect(publicationStatusMeta('PUBLISHED').color).toBe('success');
    expect(label('PUBLISHED')).toBe('Published');
    expect(publicationStatusMeta('DEPRECATED').color).toBe('warning');
    expect(label('DEPRECATED')).toBe('Deprecated');
    expect(label('NOT_PUBLISHED')).toBe('Not published');
    expect(label(undefined)).toBe('Not published');
  });

  it('only links listings that have a page on the portal', () => {
    expect(isListedOnPortal('PUBLISHED')).toBe(true);
    expect(isListedOnPortal('DEPRECATED')).toBe(true);
    expect(isListedOnPortal('NOT_PUBLISHED')).toBe(false);
  });

  it('builds the portal MCP page URL', () => {
    expect(buildViewInPortalUrl('https://portal.example.com/', 'acme', 'travel mcp')).toBe(
      'https://portal.example.com/api-portal/acme/views/default/mcp/travel%20mcp'
    );
  });
});
