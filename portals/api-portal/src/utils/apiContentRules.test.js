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
