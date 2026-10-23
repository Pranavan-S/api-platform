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

import { defineMessages, type IntlShape, type MessageDescriptor } from 'react-intl';

const messages = defineMessages({
  howTo: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.type.howTo',
    defaultMessage: 'How To',
    description: 'Document type: a step-by-step guide.',
  },
  samples: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.type.samples',
    defaultMessage: 'Samples & SDK',
    description: 'Document type: code samples and client SDKs.',
  },
  publicForum: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.type.publicForum',
    defaultMessage: 'Public Forum',
    description: 'Document type: a link to or notes about a public community forum.',
  },
  supportForum: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.type.supportForum',
    defaultMessage: 'Support Forum',
    description: 'Document type: a link to or notes about a support channel.',
  },
  other: {
    id: 'aiWorkspace.pages.appShell.appShellPages.publish.documents.type.other',
    defaultMessage: 'Other',
    description: 'Document type: anything that fits no other type.',
  },
});

/** The fixed document types, in the order they are grouped. */
export const DOCUMENT_TYPES = ['HowTo', 'Samples', 'PublicForum', 'SupportForum', 'Other'] as const;

const LABELS: Record<(typeof DOCUMENT_TYPES)[number], MessageDescriptor> = {
  HowTo: messages.howTo,
  Samples: messages.samples,
  PublicForum: messages.publicForum,
  SupportForum: messages.supportForum,
  Other: messages.other,
};

const FIXED_TYPES = new Set<string>(DOCUMENT_TYPES);

/**
 * Whether a stored type is a custom one. The server stores a custom type as the bare name the
 * user typed ("FAQ"), so anything outside the fixed set is custom.
 */
export const isCustomDocumentType = (type: string): boolean => !FIXED_TYPES.has(type);

/**
 * What to call a document's type on screen: the translated label of a fixed type, or a custom
 * type's own name exactly as stored.
 */
export const documentTypeName = (intl: IntlShape, type: string): string =>
  isCustomDocumentType(type) && type
    ? type
    : intl.formatMessage(LABELS[type as keyof typeof LABELS] ?? messages.other);
