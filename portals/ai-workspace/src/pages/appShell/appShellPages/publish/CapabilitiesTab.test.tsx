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

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/utils';
import { CapabilitiesTab } from './CapabilitiesTab';

const available = {
  tools: [{ name: 'search', description: 'Find' }, { name: 'book' }],
  resources: [{ name: 'r', uri: 'file:///r' }],
  prompts: [],
};

describe('CapabilitiesTab', () => {
  it('writes each pick into the definition JSON', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <CapabilitiesTab
        available={available}
        onChange={onChange}
        text={JSON.stringify({ tools: [{ name: 'book' }], resources: [], prompts: [] })}
      />
    );
    expect(screen.getByText('Selected: 1 of 2')).toBeInTheDocument();

    // The sections start collapsed.
    fireEvent.click(screen.getByText('Tools'));
    // A description sits beside its tool rather than behind a fold.
    expect(screen.getByText('Find')).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'search' }));
    expect(JSON.parse(onChange.mock.calls[0][0]).tools.map((tool: { name: string }) => tool.name)).toEqual([
      'search',
      'book',
    ]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all resources' }));
    expect(JSON.parse(onChange.mock.calls[1][0]).resources).toHaveLength(1);
  });

  it('only lists what a read-only version holds, without checkboxes', () => {
    renderWithProviders(<CapabilitiesTab readOnly text={JSON.stringify({ tools: [{ name: 'book' }] })} />);
    expect(screen.getByText('Total: 1')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
