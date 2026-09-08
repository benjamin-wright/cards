# cards

A collection of card games for local device play, built using react and typescript.

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
