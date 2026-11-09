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

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@wso2/oxygen-ui';
import { X } from '@wso2/oxygen-ui-icons-react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

import { useFormatters } from '@/i18n/useFormatters';

const messages = defineMessages({
  title: {
    id: 'apiControlPlane.pages.appShell.appShellPages.portals.components.PublishDraftDialog.title',
    defaultMessage: 'Publish the saved draft?',
  },
  body: {
    id: 'apiControlPlane.pages.appShell.appShellPages.portals.components.PublishDraftDialog.body',
    defaultMessage: 'A draft for {portalName} was saved {time}. It will be published as saved.',
    description:
      '{portalName} is the API Portal display name, user-supplied; do not translate it. {time} is a relative time such as "2 days ago".',
  },
  bodyNoTime: {
    id: 'apiControlPlane.pages.appShell.appShellPages.portals.components.PublishDraftDialog.bodyNoTime',
    defaultMessage: 'A draft for {portalName} was saved. It will be published as saved.',
    description: '{portalName} is the API Portal display name, user-supplied; do not translate it.',
  },
  close: {
    id: 'apiControlPlane.pages.appShell.appShellPages.portals.components.PublishDraftDialog.close',
    defaultMessage: 'Close',
    description: 'Accessible name of the icon button that dismisses the dialog without publishing.',
  },
  reviewDraft: {
    id: 'apiControlPlane.pages.appShell.appShellPages.portals.components.PublishDraftDialog.reviewDraft',
    defaultMessage: 'Review draft',
    description: 'Opens the publish page with the saved draft loaded, without publishing it.',
  },
  publishDraft: {
    id: 'apiControlPlane.pages.appShell.appShellPages.portals.components.PublishDraftDialog.publishDraft',
    defaultMessage: 'Publish draft',
    description: 'Publishes the saved draft as it is.',
  },
});

type PublishDraftDialogProps = {
  open: boolean;
  portalName: string;
  /** When the draft was last saved. */
  savedAt: string | undefined;
  onPublishDraft: () => void;
  onReviewDraft: () => void;
  onClose: () => void;
};

/** Asked before one-click Publish when a saved draft exists, so the draft is published or reviewed, never replaced. */
export function PublishDraftDialog({
  onClose,
  onPublishDraft,
  onReviewDraft,
  open,
  portalName,
  savedAt,
}: PublishDraftDialogProps) {
  const intl = useIntl();
  const { relativeTime } = useFormatters();

  return (
    <Dialog fullWidth maxWidth="xs" onClose={onClose} open={open}>
      <DialogTitle>
        <Stack alignItems="flex-start" direction="row" spacing={1.5}>
          <Typography component="span" sx={{ flex: 1, fontWeight: 600, minWidth: 0 }} variant="h6">
            <FormattedMessage {...messages.title} />
          </Typography>
          <IconButton aria-label={intl.formatMessage(messages.close)} onClick={onClose} size="small">
            <X size={18} />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {savedAt ? (
            <FormattedMessage {...messages.body} values={{ portalName, time: relativeTime(savedAt) }} />
          ) : (
            <FormattedMessage {...messages.bodyNoTime} values={{ portalName }} />
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onReviewDraft} variant="outlined">
          <FormattedMessage {...messages.reviewDraft} />
        </Button>
        <Button onClick={onPublishDraft} variant="contained">
          <FormattedMessage {...messages.publishDraft} />
        </Button>
      </DialogActions>
    </Dialog>
  );
}
