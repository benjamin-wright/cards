# cards

A collection of card games for local device play, built using react and typescript.

## Games

Players are entered once on the opening screen (2-4 players, £100 each) and the
game selection cards enable or disable themselves based on that player count.
The setup screen also has a "Reset cash" button to put everyone back to £100.

Game state is kept in local storage, so refreshing the page resumes wherever
you left off, and every game screen has an "Exit" button back to game
selection (which abandons the hand in progress).

### Blackjack

Two cards are dealt face down to each player and the house, with the house
dealt last. Each player views their own cards, may
raise their £1 entry bet using the £1, £10 and £100 buttons (press them as
often as you like, up to the cash you hold), then twists or sticks. Betting
closes for that player as soon as they twist. Aces
count as 1 or 11 in the player's favour, over 21 is bust, and the house always
twists below 15 and sticks on 15 or more. Beat the house to double your bet,
lose it if the house wins, or get it back on a draw. Every hand ends with all
cards revealed and a summary of winnings, losses and new totals.

### Rummy

Gin rummy for the same two players, with no betting. Ten cards are dealt to
each player, one card starts the discard pile and the rest becomes the stock.
On your turn you draw from the stock or take the face-up discard (which can't
be thrown straight back), then discard a card. Sets and runs are formed
automatically and shown grouped, with the left-over deadwood counted for you,
so all you have to do is tap the card you want to throw.

Knock by discarding when your deadwood is 10 or less, or go gin with none at
all. If you miss it, the knock button stays on your panel until the next card
is drawn, so either player can still knock on the hand they're holding while
the device is tipped their way. The defender's deadwood is laid off onto the knocker's melds
automatically, then the knocker scores the difference — unless the defender
matches or beats it, which is an undercut worth the difference plus 25. Gin is
worth the defender's whole hand plus 25, and the hand is abandoned as a draw if
the stock runs down to two cards. First to 100 points wins the game.

Hands are dealt face down so neither player can read the other's cards. The
table is laid out for a device lying flat between the two players, with the
piles across the middle and each player's panel turned a quarter turn to face
their own side — one player sits to the left of the device, the other to the
right.

The page is deliberately pinned to portrait, and the "Tilt setup" button asks
for that lock (plus tilt access, where the browser requires permission). With
the page locked, angling the device towards a player only changes the tilt
reading, so the browser never spins the layout around mid-turn:

- **Flat, or held level** — the device belongs to nobody and both hands stay
  face down.
- **Angled towards the left-hand player** — only their hand is shown.
- **Angled towards the right-hand player** — only their hand is shown.

The hand appears past 35° and hides again below 20°, leaving a dead band so a
wobbling hand doesn't flicker the cards open and shut. Because each panel is
already turned to face its owner, the turn prompt, result and "Next hand"
button all live inside the panels rather than in the middle strip.

Where tilt isn't available — no sensor, or permission refused — each seat falls
back to its own "Show cards" / "Hide cards" toggle, and cards go back face down
as soon as the turn passes on. Reveals are never stored, so a refresh always
comes back with hands face down.

### Roulette

Single-zero roulette for the same two players, staked from the shared cash
pile. Players take it in turns to place their chips on one shared board —
straight up numbers (35 to 1), the three column and dozen bets (2 to 1) and the
even money red/black, odd/even and high/low bets. Tap a spot to add the
selected £1, £5 or £10 chip, press and hold a spot to take that stake back off,
or use "Clear" to lift the lot. Nobody can stake more than the cash they hold.

The page is pinned to portrait like the other table games, and the board is
turned a quarter turn so it reads as a landscape betting layout facing whoever
is betting. Where tilt is available, the board only accepts chips while the
device is angled towards the player whose turn it is; without it the board is
always live for the player named at the top.

Once both players have finished, the screen switches to the wheel, with both
players' bets listed underneath. The wheel itself turns at a slow, constant
crawl and is never stopped; the ball is thrown in the other direction along an
entry tangent, runs a couple of circuits of the outer groove under a constant
deceleration, then falls into the pockets on a parabola as it comes down to the
wheel's own speed — after which it rides round in its pocket. A pop-up then
shows every bet, what it won or lost, and each player's new total.

The winning pocket is chosen as the wheel starts turning and the whole flight
is worked backwards from where that pocket will be when the ball stops, so the
ball is never nudged mid-flight and refreshing part way through settles on the
same number.

If a spin leaves either player short of the £1 minimum, that summary is still
shown with the final balances — it just drops the "Next spin" button, since
there's nothing left to bet with.

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
