const { readFileSync, writeFileSync } = require('fs');

function error({ count, line, state }) {
    throw new Error(`Unexpected state result. Expected ${
        state
    } to succeed on line ${
        parseInt(count) + 1
    }: ${line}`);
}

function firstLetterCase(str) {
    return `${str[0].toUpperCase()}${str.substr(1).toLowerCase()}`;
}

const [ _1, _2, fileName ] = process.argv;
if (process.argv.length < 3) {
    console.error('Argument expected with the path of the file to parse');
    return;
}

const translations = JSON.parse(String(readFileSync(`${__dirname}/translations.json`)));
const template = String(readFileSync(`${__dirname}/template.htm`));
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

const file = String(readFileSync(fileName));
const setupRegex = /<p>Randomization of <strong>(.*?)<\/strong>/;
const categoryMoveGames = ['diamond', 'pearl', 'platinum', 'heartgold', 'soulsilver', 'white', 'black'];
const setupResult = setupRegex.exec(file);
let withCategory = false;
if (setupResult) {
    const [ _, gameTypeResult ] = setupResult;
    const gameType = gameTypeResult.toLowerCase();
    withCategory = categoryMoveGames.some(category => gameType.includes(category));
}

const lines = file.split('\n');

const states = {
    LOOKUP: 'LOOKUP',

    EVO_BASE_POKEMON: 'EVO_BASE_POKEMON',
    EVO_CHECK_MORE: 'EVO_CHECK_MORE',
    EVO_EVOLVED_POKE: 'EVO_EVOLVED_POKE',
    EVO_NEXT_METHOD: 'EVO_NEXT_METHOD',

    STAT_POKEMON: 'STAT_POKEMON',
    STAT_TYPES: 'STAT_TYPES',
    STAT_STATS: 'STAT_STATS',

    MOVE_NAME: 'MOVE_NAME',
    MOVE_TYPE: 'MOVE_TYPE',
    MOVE_STATS: 'MOVE_STATS',

    TRADE_COPY: 'TRADE_COPY',
}

const lookups = [
    // Evolutions
    {
        lookup: /Randomized Evolutions<\/h2>/,
        nextState: states.EVO_BASE_POKEMON,
    },
    // Stats
    {
        lookup: /Pokemon Base Stats & Types<\/h2>/,
        nextState: states.STAT_POKEMON,
    },
    // Moves
    {
        lookup: /Move Data<\/h2>/,
        nextState: states.MOVE_NAME,
    },
    // Trades
    {
        lookup: /In-Game Trades<\/h2>/,
        nextState: states.TRADE_COPY,
        setCopyFrom: /<table class="trades-table">/,
        setCopyTo: /<\/table>/,
    }
];

const pokeList = [];
const moveList = [];

let state = states.LOOKUP;

let copyText;
let copyFrom;
let copyTo;
let copying;

/* ** ** ** ** ** ** ** */
/** ** DECLARATIONS ** **/
/* ** ** ** ** ** ** ** */

/* Evolutions */
const basePokeRegex = /^\s*?(.*?) now evolves into$/;
const evolvedPokeRegex = /^\s*?(.*?) -$/;
const evosEndRegex = /New Evolution Paths<\/h2>/;
let basePoke;
let evos = [];
let currentEvo;
const evoList = [];

/* Pokemon Stats */
const nameRegex = /<td class="left">(.*?)<\/td>/;
const typeRegex = /<span class="pk-type.*?">(.*?)<\/span>/;
const statRegex = /<td>(.+?)<\/td>/;
const statsEndRegex = /Removing Trade Evolutions<\/h2>/;
const pokeStatOrder = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'];
let name;
let types = [];
let currentStat = 0;
let stats = {};

/* Moves */
const movesEndRegex = /Pokemon Movesets<\/h2>/;
const moveStatOrder = ['basePower', 'accuracy', 'pp'];
if (withCategory) {
    moveStatOrder.push('category');
}

/* Trades */
let tradeTable;

/* ** ** ** ** ** ** ** */
/* ** ** ** ** ** ** ** */

lines.forEach((untrimmedLine, count) => {
    const line = untrimmedLine.trim();

    switch (state) {
        case states.LOOKUP:
            lookups.forEach(({lookup, nextState, setCopyFrom, setCopyTo}) => {
                if (line.match(lookup)) {
                    state = nextState;
                    copyFrom = setCopyFrom;
                    copyTo = setCopyTo;
                }
            });
            break;
        /* EVOLUTIONS */
        case states.EVO_BASE_POKEMON:
            if (line.match(evosEndRegex)) {
                state = states.LOOKUP;
            }
            else {
                const resultPokeRegex = basePokeRegex.exec(line);
                if (resultPokeRegex) {
                    const [_, basePokeName ] = resultPokeRegex;
                    basePoke = basePokeName;
                    state = states.EVO_CHECK_MORE;
                }
            }
            break;
        case states.EVO_CHECK_MORE:
            if (line === '<li>') {
                state = states.EVO_EVOLVED_POKE;
                currentEvo = {};
            }
            else if (line === '</ul>') {
                state = states.EVO_BASE_POKEMON;
                evoList.push({
                    basePoke,
                    evos,
                });
                basePoke = undefined;
                evos = [];
            }
            break;
        case states.EVO_EVOLVED_POKE:
            const resultEvolvedPokeRegex = evolvedPokeRegex.exec(line);
            if (resultEvolvedPokeRegex) {
                const [_, evolvedPokeName ] = resultEvolvedPokeRegex;
                currentEvo.evolvedPoke = evolvedPokeName;
                state = states.EVO_NEXT_METHOD;
            } else {
                error({ count, line, state });
            }
            break;
        case states.EVO_NEXT_METHOD:
            currentEvo.method = line;
            evos.push(currentEvo);
            state = states.EVO_CHECK_MORE;
            break;

        /* STATS and MOVES */
        case states.STAT_POKEMON:
        case states.MOVE_NAME:
            if (state === states.STAT_POKEMON && line.match(statsEndRegex) || 
                state === states.MOVE_NAME && line.match(movesEndRegex)) {
                state = states.LOOKUP;
            }
            else {
                const resultNameRegex = nameRegex.exec(line);
                if (resultNameRegex) {
                    const [ _, resultName ] = resultNameRegex;
                    name = resultName;
                    if (state === states.MOVE_NAME) {
                        name = translate(name);
                    }
                    state = state === states.STAT_POKEMON ? states.STAT_TYPES : states.MOVE_TYPE;
                }
            }
            break;
        case states.STAT_TYPES:
            if (line === '</td>') {
                state = states.STAT_STATS;
            }
            else {
                const resultTypeRegex = typeRegex.exec(line);
                if (resultTypeRegex) {
                    const [ _, type ] = resultTypeRegex;
                    types.push(type.toLowerCase());
                }
            }
            break;
        case states.MOVE_TYPE:
            const resultTypeRegex = typeRegex.exec(line);
            if (resultTypeRegex) {
                const [ _, type ] = resultTypeRegex;
                types = type.toLowerCase();
                state = states.MOVE_STATS;
            }
            else {
                error({ count, line, state });
            }
            break;
        case states.STAT_STATS:
        case states.MOVE_STATS:
            const resultStatsRegex = statRegex.exec(line);
            const statOrder = state === states.STAT_STATS ? pokeStatOrder : moveStatOrder;
            const list = state === states.STAT_STATS ? pokeList : moveList;
            if (resultStatsRegex) {
                const [ _, stat ] = resultStatsRegex;
                const currentStatName = statOrder[currentStat++];
                let parsedStat;
                if (currentStatName !== 'category') {
                    parsedStat = parseInt(stat, 10);
                } else {
                    parsedStat = firstLetterCase(stat);
                }
                stats[currentStatName] = parsedStat;
                if (currentStat >= statOrder.length) {
                    list.push({
                        name,
                        id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                        types,
                        ...stats,
                    });
                    types = [];
                    stats = {};
                    currentStat = 0;
                    name = undefined;
                    state = state === states.STAT_STATS ? states.STAT_POKEMON : states.MOVE_NAME;
                }
            } else {
                error({ count, line, state });
            }
            break;

        case states.TRADE_COPY:
            if (line.match(copyFrom)) {
                copying = true;
                copyText = [];
            }
            if (copying) {
                copyText.push(line);
            }
            if (line.match(copyTo)) {
                copyText = copyText.join('\n');
                if (state === states.TRADE_COPY) {
                    tradeTable = copyText
                }
                copyText = undefined;
                copying = false;
                state = states.LOOKUP;
            }
            break;
        default:
    }

});

const pokeTs = `export const Pokedex: {[k: string]: ModdedSpeciesData} = {
    ${pokeList.map(({id, types, hp, atk, def, spa, spd, spe }) => `${id}: {
        inherit: true,
        types: [${types.map(type => `"${firstLetterCase(type)}"`).join(', ')}],
        baseStats: {hp: ${hp}, atk: ${atk}, def: ${def}, spa: ${spa}, spd: ${spd}, spe: ${spe}}
    }`).join(`,
    `)}
};`;

const movesTs = `export const Moves: {[k: string]: ModdedMoveData} = {
    ${moveList.map(({id, types, basePower, pp, accuracy, category }) => `${id}: {
        inherit: true,
        type: "${firstLetterCase(types)}",
        basePower: ${basePower},
        pp: ${pp},
        accuracy: ${accuracy},${category ? `
        category: "${category}",` : ''}
    }`).join(`,
    `)}
};`;

const summary = `
        <ul id="toc">
            <li class="pk-type flying"><a href="#re">Randomized Evolutions</a></li>
            <li class="pk-type flying"><a href="#igt">In-Game Trades</a></li>
        </ul>

        <h2 id="re">Randomized Evolutions</h2>
        <ul>
            ${evoList.map(({basePoke, evos}) => `<li>
                ${basePoke} now evolves with these methods:
                    <ul>
                        ${evos.map(({method}) => `<li>${method}</li>`).join(`
                        `)}
                    </ul>`).join(`
            `)}
        </ul>

        <h2 id="igt">In-Game Trades</h2>
        ${tradeTable}
`;

writeFileSync('moves.ts', movesTs);
writeFileSync('pokedex.ts', pokeTs);
writeFileSync('summary.htm', template.replace('{{data}}', summary));