(function (root, factory) {
  const attribution = factory();
  if (typeof module === 'object' && module.exports) module.exports = attribution;
  root.IKAttribution = attribution;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LAUNCH_URL = 'https://tg.pulse.is/ivankosovych_bot?start=6aaf338f263824642b010bea';
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const MAX_VALUE_LENGTH = 200;
  const MAX_MATCH_DATA_LENGTH = 500;
  const FB_CLICK_ID = /^[A-Za-z0-9_-]{1,1000}$/;
  const FBC_COOKIE = /^fb\.1\.\d{10,16}\.[A-Za-z0-9_-]{1,1000}$/;
  const FBP_COOKIE = /^fb\.1\.\d{10,16}\.\d{1,200}$/;

  function boundedValue(value) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, MAX_VALUE_LENGTH);
  }

  function readParams(search) {
    try {
      return new URLSearchParams(typeof search === 'string' ? search : '');
    } catch (_) {
      return new URLSearchParams();
    }
  }

  function readCookie(cookieString, name) {
    if (typeof cookieString !== 'string') return '';
    const prefix = `${name}=`;
    for (const part of cookieString.split(';')) {
      const item = part.trim();
      if (!item.startsWith(prefix)) continue;
      const raw = item.slice(prefix.length);
      try {
        return decodeURIComponent(raw);
      } catch (_) {
        return raw;
      }
    }
    return '';
  }

  function validFbc(value) {
    return FBC_COOKIE.test(value) ? value : '';
  }

  function validFbp(value) {
    return FBP_COOKIE.test(value) ? value : '';
  }

  function fbcForLanding(params, cookieString, landingTimestamp) {
    const fbclid = params.get('fbclid');
    const cookieFbc = validFbc(readCookie(cookieString, '_fbc'));
    if (typeof fbclid === 'string' && FB_CLICK_ID.test(fbclid)) {
      if (cookieFbc && cookieFbc.split('.').slice(3).join('.') === fbclid) return cookieFbc;
      return `fb.1.${landingTimestamp}.${fbclid}`;
    }
    return cookieFbc;
  }

  function serializeMatchData(fbc, fbp) {
    const candidates = [];
    if (fbc && fbp) candidates.push({ fbc, fbp });
    if (fbc) candidates.push({ fbc });
    if (fbp) candidates.push({ fbp });
    candidates.push({});
    for (const data of candidates) {
      const serialized = JSON.stringify(data);
      if (serialized.length <= MAX_MATCH_DATA_LENGTH) return serialized;
    }
    return '{}';
  }

  function buildLaunchUrl(options) {
    const input = options || {};
    const params = readParams(input.search);
    const url = new URL(LAUNCH_URL);
    for (const key of UTM_KEYS) {
      const value = boundedValue(params.get(key));
      if (value) url.searchParams.set(key, value);
    }
    const timestamp = Number.isFinite(input.landingTimestamp) ? Math.floor(input.landingTimestamp) : Date.now();
    const fbc = fbcForLanding(params, input.cookieString, timestamp);
    const fbp = validFbp(readCookie(input.cookieString, '_fbp'));
    url.searchParams.set('meta_match_data', serializeMatchData(fbc, fbp));
    return url.toString();
  }

  function eventDetail(search) {
    const params = readParams(search);
    const detail = { destination: 'ivankosovych_bot' };
    for (const key of UTM_KEYS) {
      const value = boundedValue(params.get(key));
      if (value) detail[key] = value;
    }
    return detail;
  }

  return { buildLaunchUrl, eventDetail };
});
