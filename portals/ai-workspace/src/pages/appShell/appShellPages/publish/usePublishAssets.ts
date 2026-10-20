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

import { useCallback, useState } from 'react';
import { mcpProxiesApis } from '../../../../apis/MCP/mcpProxiesApis';
import { PLATFORM_API_BASE_URL } from '../../../../paths';
import type { ThumbnailSeed } from './usePublishPageData';

/** What the page opened with, from the freshest tier that has each part. */
type AssetsSeed = { thumbnail?: ThumbnailSeed };

/**
 * The parts of a listing that are saved on their own, apart from its details and
 * definition: what the page shows of each, and how each reaches the draft.
 *
 * Saving sends a part only when the draft does not already store the one shown. A
 * part that was pre-filled from the live listing is therefore not an edit, but is
 * still sent, since the draft has to hold it to publish it.
 */
export function usePublishAssets(apiPortalId: string, mcpProxyId: string) {
  const [thumbnail, setThumbnail] = useState<Blob>();
  // The draft's own thumbnail, and the one the page last treated as saved.
  const [storedThumbnail, setStoredThumbnail] = useState<Blob>();
  const [savedThumbnail, setSavedThumbnail] = useState<Blob>();

  /** Takes what the page opened with. */
  const seed = useCallback((opened: AssetsSeed) => {
    setThumbnail(opened.thumbnail?.blob);
    setStoredThumbnail(opened.thumbnail?.inDraft ? opened.thumbnail.blob : undefined);
    setSavedThumbnail(opened.thumbnail?.blob);
  }, []);

  /**
   * Saves the thumbnail alone, unless the draft already stores the one shown. A refused
   * image is dropped for the last saved one, so it can't fail every later save.
   */
  const saveThumbnail = async () => {
    if (!thumbnail || thumbnail === storedThumbnail) return;
    try {
      await mcpProxiesApis.saveMcpProxyApiPortalDraftThumbnail(apiPortalId, mcpProxyId, thumbnail, PLATFORM_API_BASE_URL);
    } catch (error) {
      setThumbnail(savedThumbnail);
      throw error;
    }
    setStoredThumbnail(thumbnail);
    setSavedThumbnail(thumbnail);
  };

  return {
    hasUnsavedChanges: thumbnail !== savedThumbnail,
    saveThumbnail,
    seed,
    setThumbnail,
    thumbnail,
  };
}
