const { readFileSync, writeFileSync } = require('fs');

const file = String(readFileSync(`${__dirname}/movestranslate.html`));
const lines = file.split('\n');

let expectedNextLine = 'tr';
let esName;
let enName;

const esRegex = /^<td><a href=".*?" title="(.*?)".*$/;
const enRegex = /^<td>(.*)$/;

const moves = {};

lines.forEach(line => {

    if (line === '</td>') {
        return;
    }

    if (expectedNextLine === 'tr' && line === '<tr>') {
        expectedNextLine = 'es';
    }
    else if (expectedNextLine === 'es') {
        const result = esRegex.exec(line);
        [ _, esName ] = result;
        expectedNextLine = 'type';
    }
    else if (expectedNextLine === 'type') {
        expectedNextLine = 'category';
    } else if (expectedNextLine === 'category') {
        expectedNextLine = 'contest';
    } else if (expectedNextLine === 'contest') {
        expectedNextLine = 'en';
    } else if (expectedNextLine === 'en') {
        const result = enRegex.exec(line);
        [ _, enName ] = result;
        expectedNextLine = 'type';
        moves[esName.toLowerCase()] = enName;
        expectedNextLine = 'tr';
    }

});

writeFileSync(`${__dirname}/translations.json`, JSON.stringify(moves));