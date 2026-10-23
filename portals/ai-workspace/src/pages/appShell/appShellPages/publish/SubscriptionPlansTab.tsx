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

import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Box, Button, Typography } from '@wso2/oxygen-ui';

import type { SubscriptionPlan } from '../../../../utils/types';
import type { DraftFormValues } from './mcpPublishForm';
import { PlanCard } from './PlanCard';
import { EmptyState, ErrorState, LoadingState } from './PublishStates';
import { getPlanLimitDisplay } from './subscriptionPlanLimit';

const messages = defineMessages({
  loading: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.loading',
    defaultMessage: 'Loading subscription plans',
  },
  error: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.error',
    defaultMessage: 'Unable to load subscription plans.',
  },
  emptyTitle: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.emptyTitle',
    defaultMessage: 'No subscription plans',
  },
  emptyDescription: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.emptyDescription',
    defaultMessage: 'Create subscription plans to choose from here.',
  },
  publishedEmptyTitle: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.publishedEmptyTitle',
    defaultMessage: 'This listing has no subscription plans.',
  },
  selectedSummary: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.selectedSummary',
    defaultMessage: '{count} of {total} plans selected',
    description: '{count} is a styled number rendered as a React element, not plain text; {total} is a plain number.',
  },
  publishedSummary: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.publishedSummary',
    defaultMessage: '{count, plural, one {<n>#</n> plan published} other {<n>#</n> plans published}}',
    description: '<n> wraps the number, which is styled.',
  },
  inactiveSelectedSummary: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.inactiveSelectedSummary',
    defaultMessage: '{count, plural, one {# inactive plan selected} other {# inactive plans selected}}',
    description: 'Warning next to the selection summary: selected plans that are no longer active.',
  },
  selectAll: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.selectAll',
    defaultMessage: 'Select all',
  },
  clearAll: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.plans.clearAll',
    defaultMessage: 'Clear all',
  },
});

export type SubscriptionPlansTabProps = {
  disabled?: boolean;
  /** The plans could not be read. */
  failed?: boolean;
  /** Called with every change; never when `readOnly`. */
  onChange?: (values: DraftFormValues) => void;
  /** The organization's plans; `undefined` while they load. */
  plans?: SubscriptionPlan[];
  /** Lists exactly the plans the values select, without letting them be changed. */
  readOnly?: boolean;
  /** The selection as last saved. It orders the cards, so clicking one never moves it. Defaults to `values`. */
  savedPlanIds?: string[];
  values: DraftFormValues;
};

/**
 * "Subscription Plans": which of the organization's plans this MCP proxy offers on the
 * MCP Hub. A plan's active/inactive status is set where plans are managed, not here.
 *
 * Status limits what can be *chosen*, never what is shown of the selection: the draft
 * offers the active plans, and an inactive one only while it is already selected, so it
 * can be cleared (after which it drops out). The published view lists exactly the plans
 * the live listing holds.
 *
 * Cards are ordered inactive plans first (they need clearing), then the saved selection,
 * then the rest; each group keeps the server's order.
 */
export function SubscriptionPlansTab({
  disabled,
  failed,
  onChange,
  plans,
  readOnly,
  savedPlanIds,
  values,
}: SubscriptionPlansTabProps) {
  const intl = useIntl();

  if (failed) return <ErrorState message={intl.formatMessage(messages.error)} />;
  if (!plans) return <LoadingState label={intl.formatMessage(messages.loading)} />;

  const selectedIds = values.subscriptionPlanIds;
  const selected = new Set(selectedIds);
  const saved = new Set(savedPlanIds ?? selectedIds);
  const activePlans = plans.filter((plan) => plan.status === 'ACTIVE');
  const inactiveSelectedPlans = plans.filter((plan) => plan.status !== 'ACTIVE' && selected.has(plan.id));

  // An inactive plan is offered only while it is selected, so it can still be cleared.
  const rank = (plan: SubscriptionPlan) => {
    if (plan.status !== 'ACTIVE') return 0;
    return saved.has(plan.id) ? 1 : 2;
  };
  const offeredPlans = [...activePlans, ...inactiveSelectedPlans].sort((a, b) => rank(a) - rank(b));
  const shownPlans = readOnly ? offeredPlans.filter((plan) => selected.has(plan.id)) : offeredPlans;

  if (shownPlans.length === 0) {
    return (
      <Box component="section" sx={{ p: 3 }}>
        <EmptyState
          description={readOnly ? undefined : intl.formatMessage(messages.emptyDescription)}
          title={intl.formatMessage(readOnly ? messages.publishedEmptyTitle : messages.emptyTitle)}
        />
      </Box>
    );
  }

  const selectedActiveCount = activePlans.filter((plan) => selected.has(plan.id)).length;
  const allActiveSelected = activePlans.length > 0 && selectedActiveCount === activePlans.length;

  const commitSelection = (subscriptionPlanIds: string[]) => onChange?.({ ...values, subscriptionPlanIds });
  const toggle = (planId: string) =>
    commitSelection(selected.has(planId) ? selectedIds.filter((id) => id !== planId) : [...selectedIds, planId]);
  // Select all keeps an already-selected inactive plan; Clear all clears everything.
  const toggleAll = () =>
    commitSelection(allActiveSelected ? [] : [...activePlans, ...inactiveSelectedPlans].map((plan) => plan.id));

  const countSx = { color: readOnly ? 'success.main' : 'primary.main', fontSize: 20, fontWeight: 500 } as const;

  return (
    <Box
      component="section"
      sx={{ containerType: 'inline-size', display: 'flex', flexDirection: 'column', gap: 2.5, p: 3 }}
    >
      <Box sx={{ alignItems: 'center', display: 'flex', gap: 2, justifyContent: 'space-between', minHeight: 32 }}>
        <Box sx={{ alignItems: 'baseline', display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Typography color="text.secondary" variant="body2">
            {readOnly ? (
              <FormattedMessage
                {...messages.publishedSummary}
                values={{
                  count: shownPlans.length,
                  n: (chunks) => (
                    <Typography component="span" sx={countSx}>
                      {chunks}
                    </Typography>
                  ),
                }}
              />
            ) : (
              <FormattedMessage
                {...messages.selectedSummary}
                values={{
                  count: (
                    <Typography component="span" sx={countSx}>
                      {selectedActiveCount}
                    </Typography>
                  ),
                  total: activePlans.length,
                }}
              />
            )}
          </Typography>
          {!readOnly && inactiveSelectedPlans.length > 0 && (
            <Typography color="warning.main" variant="body2">
              <FormattedMessage {...messages.inactiveSelectedSummary} values={{ count: inactiveSelectedPlans.length }} />
            </Typography>
          )}
        </Box>
        {!readOnly && (
          <Button disabled={disabled || activePlans.length === 0} onClick={toggleAll} size="small" variant="text">
            <FormattedMessage {...(allActiveSelected ? messages.clearAll : messages.selectAll)} />
          </Button>
        )}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          // Four per row, stepping down only when a card would drop below ~250px wide.
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          '@container (max-width: 1059px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
          '@container (max-width: 809px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          '@container (max-width: 519px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
        }}
      >
        {shownPlans.map((plan) => (
          <PlanCard
            disabled={disabled}
            displayName={plan.displayName}
            inactive={plan.status !== 'ACTIVE'}
            key={plan.id}
            limit={getPlanLimitDisplay(plan)}
            onToggle={() => toggle(plan.id)}
            readOnly={readOnly}
            selected={selected.has(plan.id)}
          />
        ))}
      </Box>
    </Box>
  );
}
