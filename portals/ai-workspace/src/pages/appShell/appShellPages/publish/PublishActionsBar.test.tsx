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
import { PublishActionsBar, type PublishActionsBarProps } from './PublishActionsBar';

const allowed = { publish: true, unpublish: true, deprecate: true };

const renderBar = (overrides: Partial<PublishActionsBarProps> = {}) => {
  const props: PublishActionsBarProps = {
    canDeprecate: false,
    canSaveDraft: true,
    deprecating: false,
    isPublished: false,
    onDeprecate: vi.fn(),
    onPublish: vi.fn(),
    onSaveDraft: vi.fn(),
    onUnpublish: vi.fn(),
    permissions: allowed,
    publishing: false,
    savingDraft: false,
    unpublishing: false,
    ...overrides,
  };
  renderWithProviders(<PublishActionsBar {...props} />);
  return props;
};

/** The visible label of the main button: the others in its stack are hidden, not removed. */
const mainButton = () => screen.getAllByRole('button').find((button) => button.textContent?.includes('Publish'))!;

describe('PublishActionsBar', () => {
  it('publishes by default and saves a draft only when there are edits', () => {
    const props = renderBar({ canSaveDraft: false });
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    fireEvent.click(mainButton());
    expect(props.onPublish).toHaveBeenCalledOnce();
  });

  it('offers Unpublish and Deprecate from the menu, arming rather than firing them', () => {
    const props = renderBar({ isPublished: true, canDeprecate: true });
    fireEvent.click(screen.getByRole('button', { name: 'More publish actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Unpublish/ }));
    expect(props.onUnpublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button').find((button) => button.textContent?.includes('Unpublish'))!);
    expect(props.onUnpublish).toHaveBeenCalledOnce();
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it('disables actions that do not apply or that the user may not perform', () => {
    renderBar({ isPublished: false, permissions: { ...allowed, publish: false } });
    expect(mainButton()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'More publish actions' }));
    expect(screen.getByRole('menuitem', { name: /Deprecate/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: /Unpublish/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('reads Republish once the listing is published', () => {
    renderBar({ isPublished: true, canDeprecate: true });
    expect(screen.getAllByText('Republish').length).toBeGreaterThan(0);
  });
});
