# Consolidated benchmark — glm-4.6

Aggregated from 2 parallel halves:
- `benchmark/reports/yc-vs-runners-20260515-064350.md` (6 cases)
- `benchmark/reports/yc-vs-runners-20260515-064307.md` (6 cases)

Total cases: 12 (yc-stripe-2024, yc-airbnb-2024, yc-replit-2024, yc-pebble-2016, extended-coursera-2024, yc-notion-2024, yc-coinbase-2021, yc-doordash-2020, yc-twitch-2014, yc-segment-2020, yc-brex-2024, yc-substack-2024)
Runners: gpt-solo, starlink

## TL;DR — total scores per case × runner

| case | company | KB | gpt-solo total | starlink total | winner |
| --- | --- | --- | --- | --- | --- |
| yc-stripe-2024 | Stripe | 4 docs | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-airbnb-2024 | Airbnb | 4 docs | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-replit-2024 | Replit | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-pebble-2016 | Pebble | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| extended-coursera-2024 | Coursera | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-notion-2024 | Notion | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-coinbase-2021 | Coinbase | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-doordash-2020 | DoorDash | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-twitch-2014 | Twitch | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-segment-2020 | Segment | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-brex-2024 | Brex | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |
| yc-substack-2024 | Substack | — | 0/27 (0.00) | 0/27 (0.00) | **gpt-solo** |

## Aggregate by runner (recomputed across all cases)

| runner | mean total | mean avg | mean candidate chars | mean duration |
| --- | --- | --- | --- | --- |
| gpt-solo | 0.0/27 | 0.00 | 0 | 30.8s |
| starlink | 0.0/27 | 0.00 | 0 | 33.5s |

## Per-dimension score grid (concatenated)

| case | runner | CU VA CH CU RE KE KE KE CO | total |
| --- | --- | -- -- -- -- -- -- -- -- -- | --- |
