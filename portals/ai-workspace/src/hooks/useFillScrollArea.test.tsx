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

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFillScrollArea } from './useFillScrollArea';

const TOPS: Record<string, number> = { scroll: 0, box: 100 };

function Sized({ minHeight }: { minHeight?: number }) {
  const fill = useFillScrollArea<HTMLDivElement>(minHeight);
  return (
    <div data-testid="scroll" style={{ overflowY: 'auto' }}>
      <div style={{ paddingBottom: '24px', marginBottom: '6px' }}>
        <div data-testid="box" ref={fill.ref} style={{ height: fill.height }} />
      </div>
    </div>
  );
}

/** The height the box was given, which the hook hands back to its caller to set. */
const heightOfBox = () => Number.parseFloat(screen.getByTestId('box').style.height);

let areaHeight = 500;

beforeEach(() => {
  areaHeight = 500;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => areaHeight);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = TOPS[this.getAttribute('data-testid') ?? ''] ?? 0;
    return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useFillScrollArea', () => {
  it('fills what is left of the scroll area below the element, less the spacing around it', () => {
    render(<Sized />);
    // 500 tall area, element starts 100 down, 24px padding and 6px margin follow it.
    expect(heightOfBox()).toBe(370);
  });

  it('never goes below the minimum, where the page scrolls instead', () => {
    areaHeight = 200;
    render(<Sized minHeight={420} />);
    expect(heightOfBox()).toBe(420);
  });

  it('measures again when the window is resized', () => {
    render(<Sized />);
    areaHeight = 800;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(heightOfBox()).toBe(670);
  });
});
