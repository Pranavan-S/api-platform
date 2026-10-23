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

import { describe, expect, it } from 'vitest';

import type { Gateway } from '../../../../apis/gatewayTypes';
import {
  buildProductionUrlOptions,
  definitionToText,
  draftFormValuesToInput,
  emptyDraftFormValues,
  nameInitials,
  parseDefinitionText,
  publishFormMessages,
  resolveDraftFormValues,
  sameSelection,
  validateDraftFormValues,
  type DraftFormValues,
} from './mcpPublishForm';

const filled: DraftFormValues = {
  displayName: 'Travel MCP',
  version: '1.0.0',
  description: 'Plans trips.',
  productionUrl: 'https://gw.example.com/travel/mcp',
  sandboxUrl: '',
  agentVisibility: 'VISIBLE',
  subscriptionPlanIds: ['gold'],
  docIds: ['guide'],
};

describe('resolveDraftFormValues', () => {
  const server = { displayName: 'Proxy', version: '2.0', description: 'From the proxy' };
  const draft = { displayName: 'Draft', version: '3.0', subscriptionPlanIds: ['gold'], docIds: [] };
  const publication = { displayName: 'Live', version: '1.0', subscriptionPlanIds: ['silver'], docIds: ['guide'] };

  it('starts from the draft when there is one, whatever else exists', () => {
    expect(resolveDraftFormValues(draft, publication, server, 'https://gw/mcp')).toMatchObject({
      displayName: 'Draft',
      version: '3.0',
      subscriptionPlanIds: ['gold'],
    });
  });

  it('starts from the live listing when there is no draft', () => {
    expect(resolveDraftFormValues(undefined, publication, server)).toMatchObject({
      displayName: 'Live',
      subscriptionPlanIds: ['silver'],
      docIds: ['guide'],
    });
  });

  it('starts from the proxy itself when nothing was saved, defaulting the production URL to a gateway', () => {
    expect(resolveDraftFormValues(undefined, undefined, server, 'https://gw/mcp')).toEqual({
      ...emptyDraftFormValues,
      displayName: 'Proxy',
      version: '2.0',
      description: 'From the proxy',
      productionUrl: 'https://gw/mcp',
    });
  });

  it('leaves the production URL empty when the proxy is not deployed anywhere', () => {
    expect(resolveDraftFormValues(undefined, undefined, server).productionUrl).toBe('');
  });

  it('is empty without any source', () => {
    expect(resolveDraftFormValues(undefined, undefined, undefined)).toBe(emptyDraftFormValues);
  });

  it('shows a listing that never set agent visibility as visible', () => {
    expect(resolveDraftFormValues({ displayName: 'x', version: '1' } as never, undefined, undefined).agentVisibility).toBe(
      'VISIBLE'
    );
  });

  it('reads the endpoints a draft stored', () => {
    const stored = { ...draft, endpoints: { productionUrl: 'https://p', sandboxUrl: 'https://s' } };

    expect(resolveDraftFormValues(stored, undefined, undefined)).toMatchObject({
      productionUrl: 'https://p',
      sandboxUrl: 'https://s',
    });
  });
});

describe('draftFormValuesToInput', () => {
  it('trims the text fields and sends empty ones as unset', () => {
    const input = draftFormValuesToInput({ ...filled, displayName: '  Travel  ', version: ' 1 ', description: '   ' });

    expect(input).toMatchObject({ displayName: 'Travel', version: '1', description: undefined });
  });

  it('sends the endpoints only when one is set, trimmed', () => {
    expect(draftFormValuesToInput({ ...filled, productionUrl: ' https://p ', sandboxUrl: '' }).endpoints).toEqual({
      productionUrl: 'https://p',
      sandboxUrl: undefined,
    });
    expect(draftFormValuesToInput({ ...filled, productionUrl: '', sandboxUrl: '' })).not.toHaveProperty('endpoints');
  });

  it('always sends both selections, even empty, since leaving one out would clear it', () => {
    const input = draftFormValuesToInput({ ...filled, subscriptionPlanIds: [], docIds: [] });

    expect(input.subscriptionPlanIds).toEqual([]);
    expect(input.docIds).toEqual([]);
  });

  it('carries over the tags, labels and owners the form does not show', () => {
    const owners = { technicalOwner: 'Ada' };
    const input = draftFormValuesToInput(filled, { tags: ['travel'], labels: ['hub-a'], owners });

    expect(input).toMatchObject({ tags: ['travel'], labels: ['hub-a'], owners });
  });

  it('leaves the audit and asset fields of the stored draft out', () => {
    const stored = { createdAt: 'x', hasThumbnail: true, hasLandingPage: true } as never;

    const input = draftFormValuesToInput(filled, stored);

    expect(input).not.toHaveProperty('createdAt');
    expect(input).not.toHaveProperty('hasThumbnail');
    expect(input).not.toHaveProperty('hasLandingPage');
  });
});

describe('validateDraftFormValues', () => {
  it('accepts a complete form', () => {
    expect(validateDraftFormValues(filled)).toEqual({});
  });

  it('requires a name and a version', () => {
    expect(validateDraftFormValues({ ...filled, displayName: '  ', version: '' })).toEqual({
      displayName: publishFormMessages.nameRequired,
      version: publishFormMessages.versionRequired,
    });
  });

  it('lets both URLs stay empty', () => {
    expect(validateDraftFormValues({ ...filled, productionUrl: '', sandboxUrl: '' })).toEqual({});
  });

  it.each(['mcp.example.com', 'ftp://files.example.com', 'not a url', 'javascript:alert(1)'])(
    'rejects %s as a URL',
    (url) => {
      expect(validateDraftFormValues({ ...filled, productionUrl: url, sandboxUrl: url })).toEqual({
        productionUrl: publishFormMessages.urlInvalid,
        sandboxUrl: publishFormMessages.urlInvalid,
      });
    }
  );

  it('accepts http and https URLs', () => {
    expect(
      validateDraftFormValues({ ...filled, productionUrl: 'http://localhost:8080/mcp', sandboxUrl: 'https://s.example.com' })
    ).toEqual({});
  });
});

describe('sameSelection', () => {
  it('ignores order', () => {
    expect(sameSelection(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('tells a different selection apart', () => {
    expect(sameSelection(['a'], ['a', 'b'])).toBe(false);
    expect(sameSelection(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameSelection([], [])).toBe(true);
  });
});

describe('buildProductionUrlOptions', () => {
  const gateway = (fields: Partial<Gateway>) => fields as Gateway;

  it('offers one URL per gateway, named by the gateway, in the order given', () => {
    const options = buildProductionUrlOptions(
      [
        gateway({ displayName: 'Prod', name: 'prod', endpoints: ['https://prod.example.com'] }),
        gateway({ displayName: '', name: 'stage', endpoints: ['https://stage.example.com'] }),
      ],
      '/travel'
    );

    expect(options).toEqual([
      { gatewayName: 'Prod', url: 'https://prod.example.com/travel/mcp' },
      { gatewayName: 'stage', url: 'https://stage.example.com/travel/mcp' },
    ]);
  });

  it('leaves out a gateway that has no host to build a URL from', () => {
    expect(buildProductionUrlOptions([gateway({ displayName: 'Bare', name: 'bare' })], '/travel')).toEqual([]);
  });
});

describe('the definition text', () => {
  it('always lists tools, resources and prompts first, keeping anything else after them', () => {
    const text = definitionToText({ extra: 1, tools: [{ name: 'search' }] });

    expect(Object.keys(JSON.parse(text))).toEqual(['tools', 'resources', 'prompts', 'extra']);
    expect(JSON.parse(text).tools).toEqual([{ name: 'search' }]);
  });

  it('is three empty lists for no definition', () => {
    expect(JSON.parse(definitionToText(undefined))).toEqual({ tools: [], resources: [], prompts: [] });
  });

  it('reads blank text as an empty definition', () => {
    expect(parseDefinitionText('  ')).toEqual({ definition: {} });
  });

  it('reads a JSON object', () => {
    expect(parseDefinitionText('{"tools":[]}')).toEqual({ definition: { tools: [] } });
  });

  it('refuses text that is not JSON, saying what was wrong', () => {
    const parsed = parseDefinitionText('{oops');

    expect(parsed).toMatchObject({ error: { message: publishFormMessages.definitionInvalidJson } });
    expect('error' in parsed && parsed.error.values?.detail).toBeTruthy();
  });

  it.each(['[]', 'null', '"text"', '42'])('refuses %s, which is JSON but not an object', (text) => {
    expect(parseDefinitionText(text)).toEqual({ error: { message: publishFormMessages.definitionNotObject } });
  });
});

describe('nameInitials', () => {
  it('takes the first two letters, not the word initials', () => {
    expect(nameInitials('Travel MCP')).toBe('TR');
  });

  it('skips punctuation and spaces', () => {
    expect(nameInitials('  - my.server')).toBe('MY');
  });

  it('handles short and empty names', () => {
    expect(nameInitials('x')).toBe('X');
    expect(nameInitials('')).toBe('');
  });

  it('keeps non-latin letters', () => {
    expect(nameInitials('日本語')).toBe('日本');
  });
});
