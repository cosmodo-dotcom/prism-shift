# Prism Shift

Rotate the shield, aim the cannon, capture the shards.

## Running locally

The game needs a local web server (ES modules don't load from `file://`).

```bash
npm install         # only needed once, to fetch serve (for npm run serve)
npm run serve       # then open http://localhost:8000
```

## Mobile performance

Touch devices automatically use reduced visual effects and a lower canvas
resolution to improve rendering performance.

Run upgrades are applied automatically when earned; their icons and stack counts
remain visible during the run.