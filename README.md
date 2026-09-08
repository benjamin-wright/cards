# cards

A collection of card games for local device play, built using react and typescript.

## Games

Players are entered once on the opening screen (2-4 players, £100 each) and the
game selection cards enable or disable themselves based on that player count.

### Blackjack

Two cards are dealt face down to each player and the house, with the house
dealt last. Each player views their own cards, may
raise their £1 entry bet once (£1, £10 or £100), then twists or sticks. Aces
count as 1 or 11 in the player's favour, over 21 is bust, and the house always
twists below 15 and sticks on 15 or more. Beat the house to double your bet,
lose it if the house wins, or get it back on a draw. Every hand ends with all
cards revealed and a summary of winnings, losses and new totals.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run lint     # eslint
npm test         # vitest
npm run build    # typecheck + production build into ./dist
```

## Deployment

Deployments are handled by GitHub Actions, and mirror the setup used by the
[yahtzee](https://github.com/benjamin-wright/yahtzee) project: the built `dist/`
directory is rsynced over SSH to the hosting box.

| Workflow | Trigger | Target directory | Hostname |
| --- | --- | --- | --- |
| `.github/workflows/mr.yaml` | pull requests to `main` | `cards-qa/` | `cards-qa.pongle-hub.co.uk` |
| `.github/workflows/main.yml` | pushes to `main` | `cards/` | `cards.pongle-hub.co.uk` |

Both workflows use the `production` environment and expect the following
secrets to be configured manually:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PASSWORD`

DNS records and the reverse proxy entries for `cards.pongle-hub.co.uk` and
`cards-qa.pongle-hub.co.uk` are managed outside of this repository.
