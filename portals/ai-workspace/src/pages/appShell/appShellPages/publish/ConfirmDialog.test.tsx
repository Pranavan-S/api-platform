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
import { renderWithProviders, screen } from '../../../../test/utils';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';

const renderDialog = (overrides: Partial<ConfirmDialogProps> = {}) => {
  const props: ConfirmDialogProps = {
    message: 'This removes it.',
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    open: true,
    title: 'Unpublish?',
    ...overrides,
  };
  const view = renderWithProviders(<ConfirmDialog {...props} />);
  return { ...view, props };
};

describe('ConfirmDialog', () => {
  it('confirms and cancels with its default labels', async () => {
    const { props, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it('holds back confirm until the exact phrase is typed', async () => {
    const { props, user } = renderDialog({ confirmPhrase: 'Travel MCP' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Type "Travel MCP" to confirm')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'travel mcp');
    expect(confirm).toBeDisabled();

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'Travel MCP');
    expect(confirm).toBeEnabled();

    await user.type(screen.getByRole('textbox'), '{Enter}');
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('does not confirm on Enter while the phrase is wrong', async () => {
    const { props, user } = renderDialog({ confirmPhrase: 'Travel MCP' });
    await user.type(screen.getByRole('textbox'), 'nope{Enter}');
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('forgets the typed phrase once it is closed', async () => {
    const { rerender, user, props } = renderDialog({ confirmPhrase: 'x' });
    await user.type(screen.getByRole('textbox'), 'x');
    rerender(<ConfirmDialog {...props} open={false} confirmPhrase="x" />);
    rerender(<ConfirmDialog {...props} open confirmPhrase="x" />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('cannot be confirmed or cancelled while it is working', () => {
    renderDialog({ loading: true });
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('uses the labels it is given', () => {
    renderDialog({ cancelLabel: 'Keep', confirmLabel: 'Remove', confirmInputLabel: 'Name it', confirmPhrase: 'a' });
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    expect(screen.getByText('Name it')).toBeInTheDocument();
  });
});
