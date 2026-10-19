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
import type { Theme } from '@wso2/oxygen-ui';
import { withControlPlaneTypography } from './publishTypography';

const outer = {
  palette: { mode: 'dark' },
  typography: {
    fontFamily: 'Inter',
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5, fontFamily: 'Inter' },
    caption: { fontSize: '0.7857rem', fontWeight: 400, lineHeight: 1.66, fontFamily: 'Inter' },
    button: { fontSize: '0.875rem', fontWeight: 500, textTransform: 'uppercase' },
  },
} as unknown as Theme;

describe('withControlPlaneTypography', () => {
  it('sets the control plane sizes while keeping the rest of each variant', () => {
    const { typography } = withControlPlaneTypography(outer);
    expect(typography.body1).toMatchObject({ fontSize: '0.875rem', fontFamily: 'Inter' });
    expect(typography.caption.fontSize).toBe('0.6875rem');
  });

  it('leaves variants it has no scale for, and the rest of the theme, as they were', () => {
    const themed = withControlPlaneTypography(outer);
    expect(themed.typography.button).toBe(outer.typography.button);
    expect(themed.palette).toBe(outer.palette);
  });

  it('does not change the surrounding theme', () => {
    withControlPlaneTypography(outer);
    expect(outer.typography.body1.fontSize).toBe('1rem');
  });
});
