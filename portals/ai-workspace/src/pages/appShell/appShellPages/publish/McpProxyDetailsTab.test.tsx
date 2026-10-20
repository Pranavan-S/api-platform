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

import { useState } from 'react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../../test/utils';
import { McpProxyDetailsTab, type McpProxyDetailsTabProps } from './McpProxyDetailsTab';
import { emptyDraftFormValues, type DraftFormValues } from './mcpPublishForm';

const DISCOVERABLE = 'Make this MCP proxy discoverable by AI agents';

const VALUES: DraftFormValues = {
  ...emptyDraftFormValues,
  displayName: 'Travel MCP',
  version: 'v1',
  description: 'Trip tools',
  productionUrl: 'https://gw.example.com/travel/mcp',
};

/** Holds the form's state the way the page does, and reports each change. */
function Harness({ onChange, ...props }: Partial<McpProxyDetailsTabProps> & { onChange?: (v: DraftFormValues) => void }) {
  const [values, setValues] = useState(props.values ?? VALUES);
  return (
    <McpProxyDetailsTab
      {...props}
      onChange={(next) => {
        setValues(next);
        onChange?.(next);
      }}
      values={values}
    />
  );
}

describe('McpProxyDetailsTab', () => {
  it('shows the stored values with initials for the thumbnail', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByLabelText(/Name/)).toHaveValue('Travel MCP');
    expect(screen.getByLabelText(/Version/)).toHaveValue('v1');
    expect(screen.getByLabelText('Description')).toHaveValue('Trip tools');
    expect(screen.getByLabelText('Production URL')).toHaveValue('https://gw.example.com/travel/mcp');
    expect(screen.getByText('TR')).toBeInTheDocument();
  });

  it('reports every edit as a whole new set of values', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);
    await user.type(screen.getByLabelText(/Version/), '2');
    expect(onChange).toHaveBeenLastCalledWith({ ...VALUES, version: 'v12' });
  });

  it('shows a field\'s message and tells the page when it is left', async () => {
    const onBlurField = vi.fn();
    const { user } = renderWithProviders(
      <Harness errors={{ displayName: 'Enter a name.' }} onBlurField={onBlurField} />
    );
    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Name/));
    await user.tab();
    expect(onBlurField).toHaveBeenCalledWith('displayName');
  });

  it('offers the gateway URLs, with the gateway named, and takes the one picked', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <Harness
        onChange={onChange}
        productionUrlOptions={[
          { gatewayName: 'Gateway A', url: 'https://a.example.com/travel/mcp' },
          { gatewayName: 'Gateway B', url: 'https://b.example.com/travel/mcp' },
        ]}
        values={{ ...VALUES, productionUrl: '' }}
      />
    );
    await user.click(screen.getAllByRole('button', { name: 'Show gateway URLs' })[0]);
    expect(screen.getByText('Gateway B')).toBeInTheDocument();
    await user.click(screen.getByText('https://b.example.com/travel/mcp'));
    expect(onChange).toHaveBeenLastCalledWith({ ...VALUES, productionUrl: 'https://b.example.com/travel/mcp' });
  });

  it('clears a URL', () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    // The clear button only shows while the field is hovered or focused, so it is found by its marker.
    fireEvent.click(document.querySelector('[data-clear]')!);
    expect(onChange).toHaveBeenLastCalledWith({ ...VALUES, productionUrl: '' });
  });

  it('switches between choosing a gateway URL and typing one', async () => {
    const { user } = renderWithProviders(
      <Harness productionUrlOptions={[{ gatewayName: 'Gateway A', url: 'https://a.example.com/travel/mcp' }]} />
    );
    expect(screen.getAllByRole('button', { name: 'Show gateway URLs' })).toHaveLength(1);
    await user.click(screen.getAllByRole('button', { name: 'Enter a custom URL' })[0]);
    expect(screen.queryByRole('button', { name: 'Show gateway URLs' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose from gateway URLs' })).toBeInTheDocument();
  });

  it('turns agent discovery on and off', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);
    const toggle = screen.getByLabelText(DISCOVERABLE);
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith({ ...VALUES, agentVisibility: 'HIDDEN' });
  });

  it('can only be looked at when read only', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} readOnly />);
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(DISCOVERABLE)).toBeDisabled();
    expect(document.querySelector('[data-clear]')).toBeNull();
    await user.type(screen.getByLabelText(/Name/), 'x');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has nothing to edit while an action runs', () => {
    renderWithProviders(<Harness disabled />);
    expect(screen.getByLabelText(/Name/)).toBeDisabled();
    expect(screen.getByLabelText(DISCOVERABLE)).toBeDisabled();
  });

  it('shows the thumbnail image in place of the monogram when there is one', () => {
    renderWithProviders(<Harness thumbnailUrl="blob:test/1" />);
    expect(screen.getByRole('img', { name: 'Travel MCP' })).toHaveAttribute('src', 'blob:test/1');
    expect(screen.queryByText('TR')).not.toBeInTheDocument();
  });

  it('reports the image picked to replace the thumbnail, and lets the same one be picked again', async () => {
    const onThumbnailPick = vi.fn();
    const { container, user } = renderWithProviders(<Harness onThumbnailPick={onThumbnailPick} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const image = new File(['png'], 'logo.png', { type: 'image/png' });

    expect(screen.getByRole('button', { name: 'Change thumbnail' })).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', 'image/png,image/jpeg');

    await user.upload(input, image);
    expect(onThumbnailPick).toHaveBeenLastCalledWith(image);
    expect(input.value).toBe('');
  });

  it('does not offer to change the thumbnail when it is read-only, disabled or has no handler', () => {
    const onThumbnailPick = vi.fn();
    const { rerender } = renderWithProviders(<McpProxyDetailsTab onThumbnailPick={onThumbnailPick} readOnly values={VALUES} />);
    expect(screen.queryByRole('button', { name: 'Change thumbnail' })).not.toBeInTheDocument();

    rerender(<McpProxyDetailsTab disabled onThumbnailPick={onThumbnailPick} values={VALUES} />);
    expect(screen.queryByRole('button', { name: 'Change thumbnail' })).not.toBeInTheDocument();

    rerender(<McpProxyDetailsTab values={VALUES} />);
    expect(screen.queryByRole('button', { name: 'Change thumbnail' })).not.toBeInTheDocument();
  });
});
