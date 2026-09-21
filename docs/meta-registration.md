# Meta registration attribution

## Current landing contract

- SendPulse Telegram launch URL: `https://tg.pulse.is/ivankosovych_bot?start=6aaf338f263824642b010bea`
- Meta Pixel ID: `962742956142305`
- The browser sends `PageView`, `ViewContent`, and the custom `TelegramButtonClick` event only. It must never send `CompleteRegistration`.
- Each Telegram CTA builds the launch URL on page load and again immediately before navigation. It carries bounded (200-character) string values for `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term`.
- `meta_match_data` is always present. It is a JSON string containing only validated, nonempty `fbc` and/or `fbp`, and is at most 500 characters. It is `{}` when no usable Meta identifier is available, so a repeated visitor does not retain stale contact data.

## Required SendPulse contact variables

Create or confirm these contact variables:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` — String
- `meta_match_data` — String
- `meta_events_received` — Number

## Confirmation flow

After the Telegram confirmation signal `registration_confirmed`, use this sequence:

1. Filter: `meta_registration_sent` is not set, `meta_match_data` is nonempty, and `meta_match_data != {}`.
2. Send `POST` to Graph API v25 `/events` with:
   - `event_name`: `CompleteRegistration`
   - `event_time`: `current_timestamp::int`
   - `event_id`: `tg-reg-<contact_id>`
   - `action_source`: `chat`
   - `user_data`: `meta_match_data::object`
   - header: `Authorization: Bearer <global $meta_capi_token>`
3. On a successful response where the success filter equals `1`, set `meta_registration_sent`.
4. For an error or skipped match, continue through a two-day pause; do not mark the registration as sent.

## Setup status and verification

Server key configuration is pending and the API branch is not activated. Treat the CAPI integration as setup and verification pending; this document does not claim that server-side Meta events are currently working.

Run the landing tests with:

```sh
node --test test/attribution.test.js
```

When the server branch is configured, test in this order:

1. In SendPulse, confirm the five UTM strings and `meta_match_data` arrive in the contact record.
2. In Meta Test Events, confirm one server-side `CompleteRegistration` after `registration_confirmed`.
3. Complete a real user journey.
4. Start the bot again for the same contact and confirm no duplicate registration event is sent.
