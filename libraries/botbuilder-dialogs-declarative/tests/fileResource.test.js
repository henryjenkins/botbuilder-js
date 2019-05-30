const { Configurable, TextPrompt, Dialog, DialogManager } = require('botbuilder-dialogs');
const { AdaptiveDialog } = require('botbuilder-dialogs-adaptive');
const { MemoryStorage, TestAdapter } = require('botbuilder-core');
const { FileResource } = require('../lib');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('FileResource', function () {
    this.timeout(5000);

    it('FileResource load existing file', async function () {
        const fileResource = new FileResource('tests/resources/00 - TextPrompt/SimplePrompt.main.dialog');
        assert.equal(fileResource.id(), 'SimplePrompt.main.dialog');
        const text = await fileResource.readText();
        assert.equal(text[0], '{');
    });
});
