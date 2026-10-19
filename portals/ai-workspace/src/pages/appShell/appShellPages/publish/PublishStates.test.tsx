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
import { renderWithProviders, screen } from '../../../../test/utils';
import { EmptyState, ErrorState, LoadingState } from './PublishStates';

describe('LoadingState', () => {
  it('says what it is loading, or just Loading', () => {
    const { unmount } = renderWithProviders(<LoadingState label="Loading MCP Hubs" />);
    expect(screen.getByText('Loading MCP Hubs')).toBeInTheDocument();
    unmount();
    renderWithProviders(<LoadingState />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('shows a title with an optional description', () => {
    const { unmount } = renderWithProviders(<EmptyState description="Add one first." title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add one first.')).toBeInTheDocument();
    unmount();
    renderWithProviders(<EmptyState title="Only a title" />);
    expect(screen.getByText('Only a title')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('defaults to a general title and shows the message when there is one', () => {
    renderWithProviders(<ErrorState message="It broke." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('alert')).toHaveTextContent('It broke.');
  });

  it('takes its own title', () => {
    renderWithProviders(<ErrorState title="No access" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No access');
  });
});
