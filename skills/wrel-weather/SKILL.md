---
name: wrel-weather
description: The six o'clock codebase forecast. Takes a Codebase Weather Report (report.json) and puts it on the air as a 1940s radio weather broadcast: a vintage announcer reads storm warnings, rain, heat waves, fog, deep freezes and fair skies over each region of the codebase while the honeycomb map lights up the region being read. Every line comes from the report's own evidence. Outputs an offline player, the script for one recorded read, a live-read cue sheet and a mixed broadcast WAV when a recorded read is provided. Use for a sprint review, an engineering all-hands, a talk or any time a codebase health report needs an audience.
---

# WREL Weather

The Codebase Weather Report, on the air. Clyde reads the forecast, the WREL theme plays him in and out, a chime sounds before each storm warning and the map lights up the regions he is talking about.

This is a combination skill: the Codebase Weather Report decides the weather, WREL Weather only broadcasts it. It never changes a condition, a reading or a trend.

## When to use

- A sprint review or an engineering all-hands that needs the state of the codebase in two minutes.
- A talk where a weather map alone would get a nod and a broadcast gets a laugh and a memory.

## Run

Node 20 or newer. No dependencies, no network.

```bash
# 1. The weather, from the Codebase Weather Report
codebase-weather forecast --data weather-data --out weather

# 2. On the air
node scripts/cli.js broadcast --report weather/report.json --out wrel
node scripts/cli.js broadcast --report weather/report.json --out wrel --voice-file clyde_read.wav

node scripts/cli.js demo --out wrel          # the fictional Storefront monorepo
node scripts/cli.js check --report weather/report.json
```

| Output | What it is |
| --- | --- |
| `player.html` | One offline page: the cathedral radio, the map that lights up as each region is read, the captions and The Record |
| `script.txt` | The whole forecast, one paragraph per segment, for one recorded read |
| `script.md` | A cue sheet for reading it live, with theme and chime cues |
| `broadcast.wav`, `cues.json` | The mixed broadcast and what is on the air when (with `--voice-file`) |

Without a recorded read, the player plays the theme and the browser's own voice reads the forecast.

## A real announcer

Generate `script.txt` as one read in a vintage announcer voice (for example Clyde, the vintage male radio announcer in the ElevenLabs library), save it as WAV and pass it as `--voice-file`. The mixer splits it at the paragraph pauses, choosing the split that best fits each paragraph's length, and checks every piece against its word count.

## The script rules

Full table in `references/script.md`. Sign on with the counts; one segment per warning, worst first (storm, rain, heat); one per advisory (fog, snow, wind); one for all the fair weather; sign off. Every number comes from the report.

## Human in the loop

The broadcast is advisory. Show the player and the script before sharing them anywhere, and end with "Draft, pending human review."
