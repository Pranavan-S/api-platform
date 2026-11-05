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

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { ValidationError } = require('./errors/customErrors');
const {
    isContentType,
    parseDocMetadata,
    parseImageMetadata,
    assignImageSlots,
    assertKnownTopLevelEntries,
    findDuplicateItems,
    describeItem,
    detectThumbnailType,
    readThumbnailChange,
    THUMBNAIL_TYPE_MESSAGE,
} = require('./apiContentRules');

describe('isContentType', () => {
    test('accepts the landing page, image and document types', () => {
        for (const type of ['MARKETING', 'IMAGE', 'DOC_Other', 'DOC_HowTo', 'DOC_LINK', 'DOC_my-docs_2',
            'DOC_How To', 'DOC_v1.0', 'DOC_%']) {
            assert.strictEqual(isContentType(type), true, type);
        }
    });

    test('rejects the definition, schema and partial values', () => {
        for (const type of ['API_DEFINITION', 'SCHEMA_DEFINITION', 'DOC', 'DOC_', 'A', '%', '_', 'image',
            '', undefined, null, 42]) {
            assert.strictEqual(isContentType(type), false, String(type));
        }
    });
});

describe('parseDocMetadata', () => {
    test('returns an empty list when the field is absent', () => {
        assert.deepStrictEqual(parseDocMetadata(undefined), []);
        assert.deepStrictEqual(parseDocMetadata(''), []);
    });

    test('parses links with a DOC_ type', () => {
        const raw = JSON.stringify([{ type: 'DOC_LINK', links: [{ displayName: 'Guide', url: 'https://example.com' }] }]);
        assert.deepStrictEqual(parseDocMetadata(raw)[0].links[0].displayName, 'Guide');
    });

    test('rejects text that is not JSON as a validation error naming the field', () => {
        assert.throws(() => parseDocMetadata('not-json'),
            (err) => err instanceof ValidationError && /docMetadata is not valid JSON/.test(err.message));
    });

    test('rejects the wrong shape', () => {
        for (const value of [{}, [{ type: 'DOC_LINK' }], [{ type: 'DOC_LINK', links: [{ url: 'x' }] }], ['x']]) {
            assert.throws(() => parseDocMetadata(JSON.stringify(value)), ValidationError, JSON.stringify(value));
        }
    });

    test('rejects a link type outside DOC_*', () => {
        for (const type of ['API_DEFINITION', 'LINK', 'MARKETING', 'IMAGE']) {
            const raw = JSON.stringify([{ type, links: [{ displayName: 'G', url: 'https://example.com' }] }]);
            assert.throws(() => parseDocMetadata(raw),
                (err) => err instanceof ValidationError && err.message === `Invalid link type: ${type}`);
        }
    });
});

describe('parseImageMetadata', () => {
    test('returns an empty object when the field is absent', () => {
        assert.deepStrictEqual(parseImageMetadata(undefined), {});
    });

    test('parses a slot to file name map', () => {
        assert.deepStrictEqual(parseImageMetadata('{"api-icon":"logo.png"}'), { 'api-icon': 'logo.png' });
    });

    test('rejects text that is not JSON as a validation error naming the field', () => {
        assert.throws(() => parseImageMetadata('{oops'),
            (err) => err instanceof ValidationError && /imageMetadata is not valid JSON/.test(err.message));
    });

    test('rejects the wrong shape', () => {
        for (const value of ['[]', '"x"', '{"api-icon":3}', 'null']) {
            assert.throws(() => parseImageMetadata(value), ValidationError, value);
        }
    });
});

const slotsOf = (imageMetadata, ...names) => {
    const items = [...names.map((fileName) => ({ type: 'IMAGE', fileName })), { type: 'DOC_HowTo', fileName: 'icon.png' }];
    assignImageSlots(items, imageMetadata);
    return Object.fromEntries(items.filter((item) => item.type === 'IMAGE').map((item) => [item.fileName, item.key]));
};
const rejects = (message, imageMetadata, ...names) => assert.throws(() => slotsOf(imageMetadata, ...names),
    (err) => err instanceof ValidationError && err.message === message);

describe('assignImageSlots', () => {
    test('gives an image the slot named for it, otherwise its file name without the extension', () => {
        assert.deepStrictEqual(slotsOf({}, 'logo.png', 'banner.png'), { 'logo.png': 'logo', 'banner.png': 'banner' });
        assert.deepStrictEqual(slotsOf({ 'api-icon': 'pets.png' }, 'pets.png'), { 'pets.png': 'api-icon' });
        assert.deepStrictEqual(slotsOf({ 'api-icon': '' }, 'api-icon.png'), { 'api-icon.png': 'api-icon' });
        assert.deepStrictEqual(slotsOf({}, 'constructor.png'), { 'constructor.png': 'constructor' });
    });

    test('leaves an image without a slot when metadata gives its slot to another file', () => {
        assert.deepStrictEqual(slotsOf({ 'api-icon': 'api-icon.jpg' }, 'api-icon.png', 'api-icon.jpg'),
            { 'api-icon.png': undefined, 'api-icon.jpg': 'api-icon' });
    });

    test('rejects metadata naming a file that is not an uploaded image', () => {
        rejects('imageMetadata names a file that is not in the upload: icon.png', { 'api-icon': 'icon.png' }, 'logo.png');
    });

    test('rejects metadata naming one file for two slots', () => {
        rejects('imageMetadata names logo.png for more than one slot: api-icon, banner',
            { banner: 'logo.png', 'api-icon': 'logo.png' }, 'logo.png');
    });

    test('rejects two unnamed images left with the same slot', () => {
        rejects('Images api-icon.jpg, api-icon.png use the same image slot api-icon; name one in imageMetadata',
            {}, 'api-icon.png', 'api-icon.jpg');
    });
});

describe('assertKnownTopLevelEntries', () => {
    let root;

    before(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'content-rules-'));
    });

    after(async () => {
        await fs.rm(root, { recursive: true, force: true });
    });

    const makeDir = async (name, entries) => {
        const dir = path.join(root, name);
        await fs.mkdir(dir);
        for (const entry of entries) {
            if (entry.endsWith('/')) {
                await fs.mkdir(path.join(dir, entry));
            } else {
                await fs.writeFile(path.join(dir, entry), 'x');
            }
        }
        return dir;
    };

    test('accepts web/, docs/ and OS-generated entries', async () => {
        const dir = await makeDir('ok', ['web/', 'docs/', '__MACOSX/', '.DS_Store']);
        await assertKnownTopLevelEntries(dir);
    });

    test('rejects and names every unknown folder and file', async () => {
        const dir = await makeDir('bad', ['docs/', 'doc/', 'readme.txt']);
        await assert.rejects(assertKnownTopLevelEntries(dir),
            (err) => err instanceof ValidationError
                && err.message === 'Unknown top-level entry in content ZIP: doc/, readme.txt');
    });
});

describe('findDuplicateItems', () => {
    test('finds two files with the same type and name', () => {
        const items = [
            { type: 'DOC_HowTo', fileName: 'A.md' },
            { type: 'DOC_Other', fileName: 'A.md' },
            { type: 'DOC_HowTo', fileName: 'A.md' },
        ];
        assert.deepStrictEqual(findDuplicateItems(items), [items[2]]);
    });

    test('finds two images filling the same slot', () => {
        const items = [
            { type: 'IMAGE', fileName: 'api-icon.png', key: 'api-icon' },
            { type: 'IMAGE', fileName: 'api-icon.jpg', key: 'api-icon' },
        ];
        assert.deepStrictEqual(findDuplicateItems(items), [items[1]]);
    });

    test('returns nothing for distinct items', () => {
        assert.deepStrictEqual(findDuplicateItems([
            { type: 'IMAGE', fileName: 'a.png', key: 'a' },
            { type: 'IMAGE', fileName: 'b.png', key: 'b' },
            { type: 'MARKETING', fileName: 'apiContent.md' },
        ]), []);
    });
});

describe('describeItem', () => {
    test('names a file with its type, and an image by its slot', () => {
        assert.strictEqual(describeItem({ type: 'DOC_HowTo', fileName: 'A.md' }), 'A.md (DOC_HowTo)');
        assert.strictEqual(describeItem({ type: 'IMAGE', fileName: 'api-icon.png', key: 'api-icon' }), 'image slot api-icon');
    });
});

const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00]);
const part = (buffer, originalname = 'logo.png') => ({ buffer, originalname });

describe('detectThumbnailType', () => {
    test('recognises PNG and JPEG by their leading bytes', () => {
        assert.strictEqual(detectThumbnailType(PNG), 'png');
        assert.strictEqual(detectThumbnailType(JPEG), 'jpg');
    });

    test('rejects empty, text, SVG and GIF content', () => {
        for (const buffer of [Buffer.alloc(0), Buffer.from('not an image'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
            Buffer.from('GIF89a'), PNG.subarray(0, 4), undefined]) {
            assert.strictEqual(detectThumbnailType(buffer), null);
        }
    });
});

describe('readThumbnailChange', () => {
    const rejects = (files, metadata, isCreate, message) =>
        assert.throws(() => readThumbnailChange(files, metadata, isCreate), (err) =>
            err instanceof ValidationError && (!message || err.message === message));

    test('case 1: a thumbnail with removeThumbnail true is rejected on create and update', () => {
        rejects({ thumbnail: [part(PNG)] }, { removeThumbnail: true }, true);
        rejects({ thumbnail: [part(PNG)] }, { removeThumbnail: true }, false);
    });

    test('case 2: a thumbnail replaces, named from the detected type, never the client name', () => {
        for (const isCreate of [true, false]) {
            assert.deepStrictEqual(readThumbnailChange({ thumbnail: [part(PNG, 'x.jpg')] }, {}, isCreate),
                { action: 'replace', content: PNG, fileName: 'api-icon.png' });
            assert.deepStrictEqual(readThumbnailChange({ thumbnail: [part(JPEG, '../evil.png')] }, { removeThumbnail: false }, isCreate),
                { action: 'replace', content: JPEG, fileName: 'api-icon.jpg' });
        }
    });

    test('case 3: removeThumbnail true removes on update and does nothing on create', () => {
        assert.deepStrictEqual(readThumbnailChange({}, { removeThumbnail: true }, false), { action: 'remove' });
        assert.deepStrictEqual(readThumbnailChange({}, { removeThumbnail: true }, true), { action: 'none' });
    });

    test('case 4: neither field changes nothing', () => {
        for (const isCreate of [true, false]) {
            assert.deepStrictEqual(readThumbnailChange(undefined, {}, isCreate), { action: 'none' });
            assert.deepStrictEqual(readThumbnailChange({ docs: [part(PNG)] }, { removeThumbnail: false }, isCreate), { action: 'none' });
        }
    });

    test('a part with no file name is treated as not sent', () => {
        assert.deepStrictEqual(readThumbnailChange({ thumbnail: [part(Buffer.alloc(0), '')] }, {}, false), { action: 'none' });
    });

    test('rejects content that is not PNG or JPEG, including a named empty file', () => {
        for (const buffer of [Buffer.alloc(0), Buffer.from('plain text'), Buffer.from('<svg/>'), Buffer.from('GIF89a')]) {
            rejects({ thumbnail: [part(buffer)] }, {}, false, THUMBNAIL_TYPE_MESSAGE);
        }
        assert.strictEqual(THUMBNAIL_TYPE_MESSAGE, 'Thumbnail must be a PNG or JPEG image.');
    });

    test('rejects more than one thumbnail part', () => {
        rejects({ thumbnail: [part(PNG), part(JPEG)] }, {}, false);
    });

    test('rejects a removeThumbnail that is not a boolean', () => {
        for (const value of ['true', 1, null, {}]) {
            rejects({}, { removeThumbnail: value }, false);
        }
    });
});
