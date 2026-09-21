const test = require('node:test');
const assert = require('node:assert/strict');
const attribution = require('../dist/attribution.js');

const launch = 'https://tg.pulse.is/ivankosovych_bot?start=6aaf338f263824642b010bea';

test('new fbclid outranks a stale _fbc cookie', () => {
  const url = new URL(attribution.buildLaunchUrl({
    search: '?fbclid=newClick_123',
    cookieString: '_fbc=fb.1.1700000000000.oldClick; _fbp=fb.1.1700000000000.12345',
    landingTimestamp: 1711111111111
  }));
  assert.equal(url.searchParams.get('meta_match_data'), '{"fbc":"fb.1.1711111111111.newClick_123","fbp":"fb.1.1700000000000.12345"}');
});

test('matching _fbc preserves its original click timestamp', () => {
  const url = new URL(attribution.buildLaunchUrl({
    search: '?fbclid=sameClick',
    cookieString: '_fbc=fb.1.1700000000000.sameClick',
    landingTimestamp: 1711111111111
  }));
  assert.equal(url.searchParams.get('meta_match_data'), '{"fbc":"fb.1.1700000000000.sameClick"}');
});

test('missing or invalid identifiers explicitly clear saved match data', () => {
  const url = new URL(attribution.buildLaunchUrl({ search: '?fbclid=%3Cbad%3E', cookieString: '_fbc=not-a-fbc' }));
  assert.equal(url.searchParams.get('meta_match_data'), '{}');
});

test('full encoded UTM values are decoded, bounded, and safely re-encoded', () => {
  const source = 'джерело & канал';
  const url = new URL(attribution.buildLaunchUrl({
    search: `?utm_source=${encodeURIComponent(source)}&utm_medium=cpc&utm_campaign=Autumn%20sale&utm_content=a%2Bb&utm_term=word`,
    cookieString: ''
  }));
  assert.equal(url.origin + url.pathname + '?start=' + url.searchParams.get('start'), launch);
  assert.equal(url.searchParams.get('utm_source'), source);
  assert.equal(url.searchParams.get('utm_content'), 'a+b');
  assert.equal(attribution.eventDetail('?utm_source=' + encodeURIComponent(source)).utm_source, source);
});

test('later pixel cookies are included when the click URL is recomputed', () => {
  const before = new URL(attribution.buildLaunchUrl({ search: '', cookieString: '', landingTimestamp: 1711111111111 }));
  const after = new URL(attribution.buildLaunchUrl({ search: '', cookieString: '_fbp=fb.1.1700000000000.12345', landingTimestamp: 1711111111111 }));
  assert.equal(before.searchParams.get('meta_match_data'), '{}');
  assert.equal(after.searchParams.get('meta_match_data'), '{"fbp":"fb.1.1700000000000.12345"}');
});

test('match data stays within SendPulse limits without truncating identifiers', () => {
  const fbc = `fb.1.1700000000000.${'a'.repeat(450)}`;
  const fbp = `fb.1.1700000000000.${'1'.repeat(200)}`;
  const url = new URL(attribution.buildLaunchUrl({ search: '', cookieString: `_fbc=${fbc}; _fbp=${fbp}` }));
  const matchData = url.searchParams.get('meta_match_data');
  assert.ok(matchData.length <= 500);
  assert.equal(matchData, JSON.stringify({ fbc }));
});

test('a long real fbclid is preserved whole when its match data fits', () => {
  const fbclid = 'a'.repeat(450);
  const url = new URL(attribution.buildLaunchUrl({ search: `?fbclid=${fbclid}`, cookieString: '', landingTimestamp: 1711111111111 }));
  assert.equal(url.searchParams.get('meta_match_data'), JSON.stringify({ fbc: `fb.1.1711111111111.${fbclid}` }));
});

test('an oversized real fbclid is dropped whole instead of being truncated', () => {
  const fbclid = 'a'.repeat(600);
  const url = new URL(attribution.buildLaunchUrl({ search: `?fbclid=${fbclid}`, cookieString: '', landingTimestamp: 1711111111111 }));
  assert.equal(url.searchParams.get('meta_match_data'), '{}');
});

test('malformed query encoding and cookies do not prevent a usable launch URL', () => {
  const url = new URL(attribution.buildLaunchUrl({ search: '?utm_source=%E0%A4%A&fbclid=%', cookieString: '_fbp=%E0%A4%A' }));
  assert.equal(url.origin + url.pathname, 'https://tg.pulse.is/ivankosovych_bot');
  assert.equal(url.searchParams.get('start'), '6aaf338f263824642b010bea');
  assert.equal(url.searchParams.get('meta_match_data'), '{}');
});

test('the click event remains TelegramButtonClick data and never browser registration', () => {
  assert.deepEqual(attribution.eventDetail('?utm_medium=cpc'), { destination: 'ivankosovych_bot', utm_medium: 'cpc' });
  const browserCode = require('node:fs').readFileSync(require('node:path').join(__dirname, '../dist/script.js'), 'utf8');
  assert.match(browserCode, /trackCustom', 'TelegramButtonClick'/);
  assert.doesNotMatch(browserCode, /CompleteRegistration/);
  assert.match(browserCode, /Keep the static Telegram URL when attribution storage is unavailable/);
});
