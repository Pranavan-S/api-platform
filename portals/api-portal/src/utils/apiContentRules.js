/*
 * Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com) All Rights Reserved.
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
'use strict';

const fs = require('fs').promises;
const path = require('path');
const constants = require('./constants');
const { ValidationError } = require('./errors/customErrors');

const ALLOWED_TOP_LEVEL = new Set([constants.ARTIFACT_DIR.WEB, constants.ARTIFACT_DIR.DOCS, '__MACOSX', '.DS_Store']);

const isContentType = (type) =>
    typeof type === 'string'
    && (constants.CONTENT_TYPES.FIXED.includes(type) || constants.CONTENT_TYPES.DOC_PATTERN.test(type));

const parseJsonField = (raw, field) => {
    try {
        return JSON.parse(raw);
    } catch {
        throw new ValidationError(`${field} is not valid JSON`);
    }
};

const parseDocMetadata = (raw) => {
    if (raw === undefined || raw === null || raw === '') {
        return [];
    }
    const docMetadata = parseJsonField(raw, 'docMetadata');
    if (!Array.isArray(docMetadata)) {
        throw new ValidationError('docMetadata must be an array of { type, links }');
    }
    for (const doc of docMetadata) {
        if (!doc || typeof doc !== 'object' || !Array.isArray(doc.links)) {
            throw new ValidationError('docMetadata must be an array of { type, links }');
        }
        if (!constants.CONTENT_TYPES.DOC_PATTERN.test(doc.type)) {
            throw new ValidationError(`Invalid link type: ${doc.type}`);
        }
        for (const link of doc.links) {
            if (!link || typeof link.displayName !== 'string' || !link.displayName
                || typeof link.url !== 'string' || !link.url) {
                throw new ValidationError('docMetadata links must have a displayName and a url');
            }
        }
    }
    return docMetadata;
};

const parseImageMetadata = (raw) => {
    if (raw === undefined || raw === null || raw === '') {
        return {};
    }
    const imageMetadata = parseJsonField(raw, 'imageMetadata');
    if (!imageMetadata || typeof imageMetadata !== 'object' || Array.isArray(imageMetadata)
        || Object.values(imageMetadata).some((value) => typeof value !== 'string')) {
        throw new ValidationError('imageMetadata must be an object of image slot to file name');
    }
    return imageMetadata;
};

/**
 * Give each uploaded image its slot: the one imageMetadata names it for, otherwise its file name
 * without the extension, unless imageMetadata gives that slot to another file. Rejects metadata
 * that names a file not in the upload or one file for two slots, and two images left with one slot.
 */
const assignImageSlots = (items, imageMetadata) => {
    const images = items.filter((item) => item.type === constants.DOC_TYPES.IMAGES);
    const uploaded = new Set(images.map((image) => image.fileName));
    const namedSlot = new Map();
    for (const [slot, fileName] of Object.entries(imageMetadata)) {
        if (!fileName) {
            continue;
        }
        if (!uploaded.has(fileName)) {
            throw new ValidationError(`imageMetadata names a file that is not in the upload: ${fileName}`);
        }
        if (namedSlot.has(fileName)) {
            throw new ValidationError(
                `imageMetadata names ${fileName} for more than one slot: ${[namedSlot.get(fileName), slot].sort().join(', ')}`);
        }
        namedSlot.set(fileName, slot);
    }
    const slotOwner = new Map([...namedSlot].map(([fileName, slot]) => [slot, fileName]));
    for (const image of images) {
        if (namedSlot.has(image.fileName)) {
            image.key = namedSlot.get(image.fileName);
            continue;
        }
        const slot = path.parse(image.fileName).name;
        const owner = slotOwner.get(slot);
        if (owner && !namedSlot.has(owner) && owner !== image.fileName) {
            throw new ValidationError(
                `Images ${[owner, image.fileName].sort().join(', ')} use the same image slot ${slot}; name one in imageMetadata`);
        }
        if (!owner) {
            slotOwner.set(slot, image.fileName);
            image.key = slot;
        }
    }
};

const assertKnownTopLevelEntries = async (rootPath) => {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const unknown = entries
        .filter((entry) => !ALLOWED_TOP_LEVEL.has(entry.name))
        .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
        .sort();
    if (unknown.length) {
        throw new ValidationError(`Unknown top-level entry in content ZIP: ${unknown.join(', ')}`);
    }
};

const itemIdentity = (item) =>
    (item.type === constants.DOC_TYPES.IMAGES && item.key)
        ? `${constants.DOC_TYPES.IMAGES}\u0000key\u0000${item.key}`
        : `${item.type}\u0000${item.fileName}`;

const findDuplicateItems = (items) => {
    const seen = new Set();
    const duplicates = [];
    for (const item of items) {
        const identity = itemIdentity(item);
        if (seen.has(identity)) {
            duplicates.push(item);
        } else {
            seen.add(identity);
        }
    }
    return duplicates;
};

const describeItem = (item) =>
    (item.type === constants.DOC_TYPES.IMAGES && item.key)
        ? `image slot ${item.key}`
        : `${item.fileName} (${item.type})`;

const THUMBNAIL_TYPE_MESSAGE = 'Thumbnail must be a PNG or JPEG image.';
const THUMBNAIL_SIGNATURES = [
    { ext: 'png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
    { ext: 'jpg', bytes: [0xFF, 0xD8, 0xFF] },
];

const detectThumbnailType = (buffer) => {
    if (!Buffer.isBuffer(buffer)) return null;
    const match = THUMBNAIL_SIGNATURES.find(({ bytes }) =>
        buffer.length >= bytes.length && bytes.every((byte, i) => buffer[i] === byte));
    return match ? match.ext : null;
};

/**
 * Reads the thumbnail fields of an API save: the `thumbnail` file part and `removeThumbnail`
 * in the metadata. Returns { action: 'none' | 'replace' | 'remove' } (replace adds content and
 * fileName) or throws ValidationError. A part with no file name is an empty file input.
 */
const readThumbnailChange = (files, metadata, isCreate) => {
    const parts = (files?.thumbnail || []).filter((file) => file.originalname);
    const removeThumbnail = metadata?.removeThumbnail;
    if (removeThumbnail !== undefined && typeof removeThumbnail !== 'boolean') {
        throw new ValidationError('removeThumbnail must be true or false.');
    }
    if (parts.length > 1) {
        throw new ValidationError('Only one thumbnail can be uploaded.');
    }
    if (parts.length === 1) {
        if (removeThumbnail) {
            throw new ValidationError('Send either a thumbnail or removeThumbnail, not both.');
        }
        const ext = detectThumbnailType(parts[0].buffer);
        if (!ext) {
            throw new ValidationError(THUMBNAIL_TYPE_MESSAGE);
        }
        return { action: 'replace', content: parts[0].buffer, fileName: `${constants.API_ICON}.${ext}` };
    }
    return removeThumbnail && !isCreate ? { action: 'remove' } : { action: 'none' };
};

module.exports = {
    THUMBNAIL_TYPE_MESSAGE,
    detectThumbnailType,
    readThumbnailChange,
    isContentType,
    parseDocMetadata,
    parseImageMetadata,
    assignImageSlots,
    assertKnownTopLevelEntries,
    findDuplicateItems,
    describeItem,
};
