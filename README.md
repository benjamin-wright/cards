# cards

A collection of card games for local device play, built using react and typescript.

## Games

Players are entered once on the opening screen (2-4 players, £100 each) and the
game selection cards enable or disable themselves based on that player count.
The setup screen also has a "Reset cash" button to put everyone back to £100.

Game state is kept in local storage, so refreshing the page resumes wherever
you left off, and every game screen has an "Exit" button back to game
selection (which abandons the hand in progress).

In Crazy Eights, players keep their moves private until a finished hand is
revealed with **Show hands** on a flat device. In cribbage, discards and card
choices happen in private seats; lay the device flat to inspect the public
board, reveal scored hands, and continue after the hand.

### Blackjack

Two cards are dealt privately to each player. Players take turns twisting
(drawing a card) or sticking (keeping their hand); going over 21 ends a turn
automatically. Aces count as 1 or 11, whichever helps without going bust.
Once both players have finished, set the phone flat and tap **Show hands**.
Their cards slide in from either side onto the shared table; after a short
pause the win/loss summary appears. The higher non-bust hand earns one point;
equal hands or two bust hands draw. Scores carry over between hands, and the
starting player alternates. There is no house or betting, and cash is unaffected.

Like the other table games, the device lies flat between players in portrait
with their seats facing left and right. Tip it towards a player to reveal
only their own hand and controls; both hands stay hidden while flat.

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

When a hand ends, set the device flat and tap **Show hands** to reveal both
hands and the outcome together. Match points are added at the reveal.

Hands are dealt face down so neither player can read the other's cards. The
table is laid out for a device lying flat between the two players, with the
piles across the middle and each player's panel turned a quarter turn to face
their own side — one player sits to the left of the device, the other to the
right.

Keep the device upright and turn on its portrait orientation lock. Angling the
device towards a player then changes the tilt reading without rotating the
page. If the page does rotate into landscape, a full-screen warning covers the
game until it returns to portrait. On browsers that require motion permission,
a separate full-screen prompt asks for it; the game stays covered until a tilt
reading is received:

- **Flat, or held level** — the device belongs to nobody and both hands stay
  face down.
- **Angled towards the left-hand player** — only their hand is shown.
- **Angled towards the right-hand player** — only their hand is shown.

The hand appears past 35° and hides again below 20°, leaving a dead band so a
wobbling hand doesn't flicker the cards open and shut. Because each panel is
already turned to face its owner, the turn prompt, result and "Next hand"
button all live inside the panels rather than in the middle strip.

Where tilt isn't available — no sensor, or permission refused — the prompt
allows another attempt or a return to game selection. There is no manual
show/hide mode. The game stays mounted behind the prompts, so returning to
portrait or granting permission doesn't abandon the hand. A refresh starts
with hands face down until the device is tipped towards a player.

### Roulette

Single-zero roulette for the same two players, staked from the shared cash
pile. Either player can tip the device towards themselves to place chips at
any time on their own private board —
straight up numbers (35 to 1), the three column and dozen bets (2 to 1) and the
even money red/black, odd/even and high/low bets. Tap a spot to add the
selected £1, £5 or £10 chip, press and hold a spot to take that stake back off,
or use "Clear" to lift the lot. Nobody can stake more than the cash they hold.

When both players are ready, set the device flat and tap **SPIN** in the
middle of the wheel. At least one bet is needed; either player may sit out.
Bets and the result are then shown on the shared table.

Keep the page in portrait like the other table games; the board is
turned a quarter turn so it reads as a landscape betting layout facing the
player placing chips. The wheel turns away behind the board the whole time, with the
betting spots left slightly see-through so it shows through them. The board
only accepts chips while the device is angled towards that player.

Once **SPIN** is pressed, the board fades away and the bets are listed
underneath the wheel. The same wheel is used at the same size throughout and is
never remounted, so the switch is only the board fading out and the blur over
the wheel lifting — nothing slides or resizes. The wheel itself turns at a slow, constant
crawl and is never stopped; the ball is thrown in the other direction along an
entry tangent, runs a couple of circuits of the outer groove under a constant
deceleration, then falls into the pockets on a parabola as it comes down to the
wheel's own speed — after which it rides round in its pocket. A pop-up then
shows every bet, what it won or lost, and each player's new total.

The winning pocket is chosen as the wheel starts turning and the whole flight
is worked backwards from where that pocket will be when the ball stops, so the
ball is never nudged mid-flight and refreshing part way through settles on the
same number.

If a spin leaves both players short of the £1 minimum, that summary is still
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
