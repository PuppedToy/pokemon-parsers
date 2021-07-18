const { readFileSync, writeFileSync } = require('fs');

const file = String(readFileSync(`${__dirname}/TorneoNew.gba.log`));
const translations = JSON.parse(String(readFileSync(`${__dirname}/translations.json`)));
function translate(moveName) {
    const parsedName = moveName.toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    if (Object.hasOwnProperty.call(translations, parsedName)) {
        return translations[parsedName];
    }
    else {
        return moveName;
    }
}

const pokeList = [];
// 1|Bulbasaur |GRASS/POISON     |  59|  57|  36|  79|  19|  69|FORECAST    |LIQUID OOZE |LUM BERRY (rare)
const moveList = [];

let currentDataType;
let dataTypes = {
    'Pokemon Base Stats & Types': 'baseStats',
    'Move Data': 'moves',
}

function firstLetterCase(str) {
    return `${str[0].toUpperCase()}${str.substr(1).toLowerCase()}`;
}

function parseStat(stat) {
    return parseInt(stat.trim(), 10);
}

file.split('\n').forEach(line => {
    if(line.substr(0, 2) === '--') {
        currentDataType = dataTypes[line.replace(/-/g, '').trim()];
    }
    else if(line.trim() !== '' && line.substr(0, 8) !== 'NUM|NAME') {
        if (currentDataType === 'baseStats') {
            const data = line.split('|');
            const [ _1, name, types, hp, atk, def, spe, spa, spd ] = data;
            pokeList.push({
                id: name.trim().toLowerCase().replace(/[^a-z]/g, ''),
                // types: types.trim().split('/').map(type => firstLetterCase(type)),
                hp: parseStat(hp),
                atk: parseStat(atk),
                def: parseStat(def),
                spa: parseStat(spa),
                spd: parseStat(spd),
                spe: parseStat(spe),
            });
        }
        else if (currentDataType === 'moves') {
            const data = line.split('|');
            const [ _1, name, type, basePower, accuracy, pp ] = data;
            const translatedName = translate(name);
            moveList.push({
                id: translatedName.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
                basePower: parseStat(basePower),
                pp: parseStat(pp),
                accuracy: parseStat(accuracy)
            });
        }
    }
});

const poke = `export const Pokedex: {[k: string]: ModdedSpeciesData} = {
    ${pokeList.map(({id, hp, atk, def, spa, spd, spe }) => `${id}: {
        inherit: true,
        baseStats: {hp: ${hp}, atk: ${atk}, def: ${def}, spa: ${spa}, spd: ${spd}, spe: ${spe}}
    }`).join(`,
    `)}
};`;

const moves = `export const Moves: {[k: string]: ModdedMoveData} = {
    ${moveList.map(({id, basePower, pp, accuracy }) => `${id}: {
        inherit: true,
        basePower: ${basePower},
        pp: ${pp},
        accuracy: ${accuracy},
    }`).join(`,
    `)}
};`;

writeFileSync(`${__dirname}\\pokedex.ts`, poke);
writeFileSync(`${__dirname}\\moves.ts`, moves);