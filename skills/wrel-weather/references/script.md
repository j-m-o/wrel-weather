# The script rules

The announcer reads only what the Codebase Weather Report found. The weather, the readings and the trends all come from its `report.json`; WREL Weather never recomputes or changes them.

## Running order

1. **Sign on.** The station, the codebase, the week and the counts of warnings, advisories and fair regions.
2. **Warnings, worst first.** One segment per region: thunderstorms, then rain, then heat waves, ties broken by temperature. A station chime sounds before each storm warning.
3. **Advisories.** One segment per region: fog, then snow, then wind.
4. **Fair weather.** One segment for every sunny and partly cloudy region together.
5. **Sign off.** Any source the report had no reading for, then good night.

## What each segment says

| Condition | The announcer says |
| --- | --- |
| Thunderstorm | A storm warning; which incident remains open (or struck and has since cleared); failing tests; temperature and commits; the trend if it is moving |
| Rain | How many tests are failing; the trend if it is moving |
| Heat wave | Commits this week against the usual week; the temperature; the trend if it is moving |
| Fog | Coverage, and "persists" if it was foggy the week before, otherwise "has rolled in" |
| Snow | Days since the last commit |
| Windy | Outdated dependencies |
| Sunny and partly cloudy | The regions, together |

The flourishes ("Proceed with caution", "a deep freeze", "where a few flaky tests drift by") are fixed per condition and never add a fact.

## The map

Each segment lists the regions it covers, and the player lights those hexagons gold while that segment is on the air.

## Never

People's names, numbers that are not in the report or a forecast of the future. The trend is what happened, not a prediction.
