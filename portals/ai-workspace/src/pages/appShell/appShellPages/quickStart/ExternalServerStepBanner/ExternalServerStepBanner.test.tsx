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
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '../../../../../test/utils';
import ExternalServerStepBanner from './ExternalServerStepBanner';

describe('ExternalServerStepBanner', () => {
  it('counts three steps and has no publish step unless publishing is offered', () => {
    renderWithProviders(<ExternalServerStepBanner hasPolicies hasDeployments={false} />);
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.queryByText('Publish to MCP Hub')).not.toBeInTheDocument();
  });

  it('adds a fourth step once publishing is offered, and counts it when published', () => {
    const { rerender } = renderWithProviders(
      <ExternalServerStepBanner hasPolicies hasDeployments hasPublication={false} />
    );
    expect(screen.getByText('3/4')).toBeInTheDocument();
    rerender(<ExternalServerStepBanner hasPolicies hasDeployments hasPublication />);
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('reports a click on the publish step', () => {
    const onStepClick = vi.fn();
    renderWithProviders(
      <ExternalServerStepBanner
        hasPolicies={false}
        hasDeployments={false}
        hasPublication={false}
        onStepClick={onStepClick}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Publish to MCP Hub/ }));
    expect(onStepClick).toHaveBeenCalledWith('publish-to-mcp-hub');
  });
});
