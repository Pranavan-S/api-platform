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

import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../../test/utils';
import type { SubscriptionPlan } from '../../../../utils/types';
import { emptyDraftFormValues, type DraftFormValues } from './mcpPublishForm';
import { SubscriptionPlansTab, type SubscriptionPlansTabProps } from './SubscriptionPlansTab';

const plan = (id: string, displayName: string, overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan => ({
  id,
  displayName,
  status: 'ACTIVE',
  ...overrides,
});

const bronze = plan('bronze', 'Bronze', {
  limits: [{ limitCount: 1000, limitType: 'REQUEST_COUNT', timeAmount: 1, timeUnit: 'HOUR' }],
});
const gold = plan('gold', 'Gold'); // no limits — "Unlimited"
const silver = plan('silver', 'Silver');
const zinc = plan('zinc', 'Zinc');
const legacy = plan('legacy', 'Legacy', { status: 'INACTIVE' });

const values = (subscriptionPlanIds: string[] = []): DraftFormValues => ({ ...emptyDraftFormValues, subscriptionPlanIds });

/** The plan names in the order the cards are shown. */
const cardOrder = (names: string[]) =>
  screen.getAllByRole('checkbox').map((card) => names.find((name) => card.textContent?.startsWith(name)));

/** Matches text split across the summary row's nested count element. */
const summaryText = (text: string) => screen.getAllByText((_content, element) => element?.textContent === text)[0];

const renderTab = (props: Partial<SubscriptionPlansTabProps> = {}) =>
  renderWithProviders(<SubscriptionPlansTab plans={[bronze, gold, legacy]} values={values()} {...props} />);

describe('SubscriptionPlansTab', () => {
  it('waits for the plans, and says when they could not be read', () => {
    const { unmount } = renderTab({ plans: undefined });
    expect(screen.getByText('Loading subscription plans')).toBeInTheDocument();
    unmount();
    renderTab({ failed: true, plans: undefined });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load subscription plans.');
  });

  it('lists the selected inactive plan first, then the selected plans, then the rest, flagging only the inactive one, counting only the active plans', () => {
    renderTab({ plans: [legacy, bronze, gold], values: values(['bronze', 'legacy']) });
    expect(cardOrder(['Legacy', 'Bronze', 'Gold'])).toEqual(['Legacy', 'Bronze', 'Gold']);
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('requests / hour')).toBeInTheDocument();
    expect(screen.getAllByText('Unlimited')).toHaveLength(2);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(summaryText('1 of 2 plans selected')).toBeInTheDocument();
  });

  it("orders inactive plans first, then the saved selection, then the rest, each in the server's order", () => {
    renderTab({ plans: [bronze, gold, silver, legacy, zinc], values: values(['zinc', 'gold', 'legacy']) });
    const names = ['Legacy', 'Gold', 'Zinc', 'Bronze', 'Silver'];
    expect(cardOrder(names)).toEqual(names);
  });

  it('orders by the saved selection, so a plan selected but not yet saved stays where it was', () => {
    renderTab({ plans: [bronze, gold, silver], savedPlanIds: ['gold'], values: values(['gold', 'silver']) });
    expect(cardOrder(['Gold', 'Bronze', 'Silver'])).toEqual(['Gold', 'Bronze', 'Silver']);
  });

  it('keeps a saved plan in the saved group when it is deselected, so a click never moves a card', () => {
    renderTab({ plans: [bronze, gold, silver], savedPlanIds: ['silver'], values: values() });
    expect(cardOrder(['Silver', 'Bronze', 'Gold'])).toEqual(['Silver', 'Bronze', 'Gold']);
  });

  it('shows an empty state and no Select all button when the organization has no plans', () => {
    renderTab({ plans: [] });
    expect(screen.getByText('No subscription plans')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /select all|clear all/i })).not.toBeInTheDocument();
  });

  it('offers no inactive plan that is not selected, so an all-inactive organization shows the empty state', () => {
    renderTab({ plans: [legacy] });
    expect(screen.getByText('No subscription plans')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Legacy/ })).not.toBeInTheDocument();
  });

  it('toggles an active plan on click, reporting the full updated selection', async () => {
    const onChange = vi.fn();
    const { user } = renderTab({ onChange, values: values(['bronze']) });
    await user.click(screen.getByRole('checkbox', { name: /Gold/ }));
    expect(onChange).toHaveBeenLastCalledWith(values(['bronze', 'gold']));
    await user.click(screen.getByRole('checkbox', { name: /Bronze/ }));
    expect(onChange).toHaveBeenLastCalledWith(values([]));
  });

  it('does not offer an inactive plan that is not selected', () => {
    renderTab();
    expect(screen.queryByRole('checkbox', { name: /Legacy/ })).not.toBeInTheDocument();
    expect(summaryText('0 of 2 plans selected')).toBeInTheDocument();
  });

  it('keeps a selected inactive plan, counts it separately, and lets it be cleared', async () => {
    const onChange = vi.fn();
    const { user } = renderTab({ onChange, values: values(['legacy']) });
    expect(screen.getByText('1 inactive plan selected')).toBeInTheDocument();
    expect(summaryText('0 of 2 plans selected')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Legacy/ }));
    expect(onChange).toHaveBeenLastCalledWith(values([]));
  });

  it('selects every active plan and keeps a selected inactive one, then clears them all', async () => {
    const onChange = vi.fn();
    const { user, rerender } = renderTab({ onChange, values: values(['legacy']) });
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(onChange).toHaveBeenLastCalledWith(values(['bronze', 'gold', 'legacy']));

    rerender(<SubscriptionPlansTab onChange={onChange} plans={[bronze, gold, legacy]} values={values(['bronze', 'gold'])} />);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenLastCalledWith(values([]));
  });

  it('locks the cards and Select all while an action runs', async () => {
    const onChange = vi.fn();
    const { user } = renderTab({ disabled: true, onChange });
    await user.click(screen.getByRole('checkbox', { name: /Bronze/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /Bronze/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled();
  });

  describe('read-only', () => {
    it('lists only the plans the listing holds, an inactive one first, without Select all', () => {
      renderTab({ readOnly: true, values: values(['bronze', 'legacy']) });
      expect(cardOrder(['Legacy', 'Bronze'])).toEqual(['Legacy', 'Bronze']);
      expect(screen.queryByRole('button', { name: /select all|clear all/i })).not.toBeInTheDocument();
      expect(summaryText('2 plans published')).toBeInTheDocument();
    });

    it('says so when the listing has no plans', () => {
      renderTab({ readOnly: true });
      expect(screen.getByText('This listing has no subscription plans.')).toBeInTheDocument();
    });

    it('does not report a click', () => {
      const onChange = vi.fn();
      renderTab({ onChange, readOnly: true, values: values(['bronze']) });
      const card = screen.getByRole('checkbox', { name: /Bronze/ });
      expect(card).toHaveStyle({ pointerEvents: 'none' });
      fireEvent.click(card);
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
