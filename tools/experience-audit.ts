import { formatDuration } from '../src/format.ts';
import { cheapSeconds, clock, judgeCards, measure, playRobot, replayLogs, reportBands, reportCards, reportCurrencies, reportOddities, type Judged, type Measures } from './audit.ts';
import { readArgument } from './shared.ts';

// npm run audit [-- --seed 7]             the attentive robot
// npm run audit -- --style earner         the robot that goes for income first
// npm run audit -- --log a.jsonl,b.jsonl  a real play, from its session logs
// npm run audit -- --style earner --brief only the four measures

function reportMeasures(measures: Measures): void {
    const named = (cards: readonly Judged[]): string => (cards.length === 0 ? '' : ` (${cards.map((card) => `${card.purchase.item.name} ${formatDuration(card.worthSeconds!)}`).join(', ')})`);
    const percent = (value: number): string => `${Math.round(value * 100)}%`;
    const bought = (purchase: Measures['lastPayCard']): string => (purchase === undefined ? 'never' : `${clock(purchase.seconds)} (level ${purchase.before.level})`);
    console.log('\nThe four measures');
    console.log(`1. Worth of a card when it appears: ${measures.roomy.length} between one and six minutes`);
    console.log(`   under ${cheapSeconds} seconds: ${measures.cheap.length}${named(measures.cheap)}`);
    console.log(`   under a minute: ${measures.underAMinute.length}${named(measures.underAMinute)}`);
    console.log(`   over six minutes: ${measures.dear.length}${named(measures.dear)}`);
    console.log(`2. Rent of every address, of the income: ${measures.rentShares.map((band) => `levels ${band.fromLevel} to ${band.toLevel} ${percent(band.share)}`).join(', ') || 'nothing rented'}`);
    console.log(`3. A card waited for it, and left over: ${Object.entries(measures.use).map(([currency, use]) => `${currency} ${percent(use.waited)} of the time and ${percent(use.leftOver)}`).join('; ')}`);
    console.log(`4. Last pay card at ${bought(measures.lastPayCard)}, last script card at ${bought(measures.lastScriptCard)}; the play ends at ${clock(measures.end.seconds)} (level ${measures.end.level})`);
}

const logs = readArgument('--log');
const play = logs === undefined ? playRobot(Number(readArgument('--seed') ?? '1'), readArgument('--style') === 'earner' ? 'earner' : 'attentive') : replayLogs(logs.split(','));
const end = play.readings.at(-1)!;
console.log(`Audit of ${play.name}: level ${end.level} after ${clock(end.seconds)}, ${play.purchases.length} cards bought`);
const judged = judgeCards(play);
if (!process.argv.includes('--brief')) {
    reportCurrencies(play);
    reportBands(play);
    reportCards(judged);
    reportOddities(play, judged);
}
reportMeasures(measure(play, judged));
