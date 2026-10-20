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

import type { ReactNode } from 'react';
import { alpha, Box, Stack, Typography } from '@wso2/oxygen-ui';

type OverviewLifecycleStageProps = {
  icon: ReactNode;
  /** Where the proxy stands in this stage, e.g. "Deployed". */
  status: string;
  /** Whether the stage is done; tints the icon and the status dot. */
  isDone: boolean;
  /** The button that moves the proxy through this stage. */
  action: ReactNode;
};

/** One stage of the proxy's lifecycle (deployment, publication) on the overview header. */
export default function OverviewLifecycleStage({
  icon,
  status,
  isDone,
  action,
}: OverviewLifecycleStageProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ px: 3, py: 2.5, minWidth: 0, bgcolor: 'background.paper' }}
    >
      <Box
        sx={(theme) => ({
          width: 40,
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1.5,
          bgcolor: isDone
            ? alpha(theme.palette.success.main, 0.14)
            : 'action.hover',
          color: isDone ? 'success.main' : 'text.secondary',
        })}
      >
        {icon}
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ flex: 1, minWidth: 0 }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            flexShrink: 0,
            borderRadius: '50%',
            bgcolor: isDone ? 'success.main' : 'text.disabled',
          }}
        />
        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
          {status}
        </Typography>
      </Stack>
      <Box sx={{ flexShrink: 0 }}>{action}</Box>
    </Stack>
  );
}
