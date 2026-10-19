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
import { capabilityRows, setAllCapabilities, toggleCapability } from './mcpCapabilitySelection';

const available = [{ name: 'search', description: 'Find' }, { name: 'book' }];

describe('capabilityRows', () => {
  it('lists the proxy items in its order, selected when the definition holds them', () => {
    const rows = capabilityRows('tools', available, { tools: [{ name: 'book' }] });
    expect(rows.map(({ key, selected, onProxy }) => [key, selected, onProxy])).toEqual([
      ['search', false, true],
      ['book', true, true],
    ]);
  });

  it('keeps the definition\'s own version of an item, and items the proxy does not offer', () => {
    const rows = capabilityRows('tools', available, { tools: [{ name: 'search', description: 'Edited' }, { name: 'legacy' }] });
    expect(rows[0].item).toEqual({ name: 'search', description: 'Edited' });
    expect(rows[2]).toMatchObject({ key: 'legacy', onProxy: false, selected: true });
  });

  it('tells resources apart by URI', () => {
    const rows = capabilityRows('resources', [{ name: 'a', uri: 'file:///a' }], { resources: [{ uri: 'file:///a' }] });
    expect(rows[0].selected).toBe(true);
  });

  it('treats a definition with no list for the kind as selecting nothing', () => {
    expect(capabilityRows('prompts', [{ name: 'p' }], {}).map((row) => row.selected)).toEqual([false]);
  });
});

describe('toggleCapability', () => {
  it('adds an unselected item and removes a selected one, leaving the rest of the definition alone', () => {
    const definition = { tools: [{ name: 'book' }], extra: { keep: true } };
    const added = toggleCapability(definition, 'tools', available, 'search');
    expect(added).toEqual({ tools: [{ name: 'search', description: 'Find' }, { name: 'book' }], resources: [], prompts: [], extra: { keep: true } });
    expect(toggleCapability(added, 'tools', available, 'book').tools).toEqual([{ name: 'search', description: 'Find' }]);
  });

  it('always writes all three lists, tools first', () => {
    const next = toggleCapability({}, 'prompts', [{ name: 'p' }], 'p');
    expect(Object.keys(next)).toEqual(['tools', 'resources', 'prompts']);
  });
});

describe('setAllCapabilities', () => {
  it('selects or clears every item of one kind', () => {
    expect(setAllCapabilities({}, 'tools', available, true).tools).toEqual(available);
    expect(setAllCapabilities({ tools: available }, 'tools', available, false).tools).toEqual([]);
  });
});
