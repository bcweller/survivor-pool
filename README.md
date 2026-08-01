# 🏈 Survivor Pool

A self-hosted NFL "survivor" / "knockout" pool. Each week every player picks one
team they think wins straight-up. Win or tie → advance. Lose → eliminated.
Each team can only be picked once per player, all season. Last player standing
wins the pot (if everyone still alive loses in the same week, the pot splits
among that week's remaining players — see "League rules & assumptions" below).

Stack: Next.js 14 (App Router) + TypeScript, PostgreSQL via Prisma, Auth.js
(NextAuth) for login, Tailwind for styling, Nodemailer for email, and ESPN's
public scoreboard feed for schedules/scores/spreads. Ships as a Docker Compose
stack (app + Postgres) for your Ubuntu box, fronted by nginx + Let's Encrypt.

## 1. What you need before you start

- An Ubuntu server (20.04+) reachable from the internet, with a domain name
  pointed at it (an A record). You can't easily get social login or a trusted
  padlock without a real domain.
- Docker + Docker Compose installed (`curl -fsSL https://get.docker.com | sh`).
- Ports 80/443 open on the server's firewall.
- An SMTP account for sending email — the easiest free-tier options are a
  Gmail account with an "app password", or a free Mailgun/SendGrid/Brevo
  account. Gmail caps at ~500 emails/day, which is plenty for a friends league.
- Developer accounts with whichever social login providers you want
  (see section 4) — all are free.

## 2. First-time deployment

```bash
# on the server
git clone <your-repo-url> survivor-pool   # or scp this folder over
cd survivor-pool
cp .env.example .env
nano .env   # fill in every value — see sections below

docker compose up -d --build
```

This builds the app image, starts Postgres, runs `prisma migrate deploy`,
seeds the 32 NFL teams, and starts the app on port 3000. Then set up nginx:

```bash
sudo cp nginx/survivor-pool.conf /etc/nginx/sites-available/survivor-pool
sudo ln -s /etc/nginx/sites-available/survivor-pool /etc/nginx/sites-enabled/
sudo nano /etc/nginx/sites-available/survivor-pool   # replace your-domain.com
sudo nginx -t && sudo systemctl reload nginx
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Visit `https://your-domain.com`, sign up, and create your league — you become
its commissioner automatically. Share the invite code (shown on the
Commissioner page) with your friends.

## 3. Keeping scores in sync (cron)

The app never polls ESPN on its own — a cron job tells it when to check.
Add this to the server's crontab (`crontab -e`), which runs every 15 minutes
during the season:

```
*/15 * * * * cd /path/to/survivor-pool && docker compose exec -T app npm run sync:scores >> /var/log/survivor-pool-sync.log 2>&1
```

Each run: pulls the current week's games/scores/spreads from ESPN, marks
finished games, settles picks (win/loss/elimination), auto-picks for anyone
who missed the lock once it has passed, and emails results. It's idempotent,
so running it often is safe.

## 4. Social login setup

Only configure the providers you actually want in `.env` — anything left
blank is simply not shown as a login option. Email/password always works
as a fallback.

**Google** (simplest): [Google Cloud Console](https://console.cloud.google.com/)
→ APIs & Services → Credentials → Create OAuth client ID (Web application).
Authorized redirect URI: `https://your-domain.com/api/auth/callback/google`.

**Microsoft**: [Azure Portal](https://portal.azure.com/) → App registrations
→ New registration → Accounts in any organizational directory and personal
Microsoft accounts. Redirect URI: `https://your-domain.com/api/auth/callback/azure-ad`.
Create a client secret under Certificates & secrets. Leave `MICROSOFT_TENANT_ID=common`
so both personal and work/school accounts can sign in.

**Yahoo**: [Yahoo Developer Network](https://developer.yahoo.com/apps/) →
Create an app → enable "Sign in with Yahoo" (OpenID Connect). Redirect URI:
`https://your-domain.com/api/auth/callback/yahoo`. Yahoo's console is a bit
clunkier than Google's/Microsoft's and occasionally needs the app set to
"Confidential Client" — if login fails, double check that setting first.

**Facebook**: [Meta for Developers](https://developers.facebook.com/) →
Create App → Consumer type → add "Facebook Login" product. Valid OAuth
redirect URI: `https://your-domain.com/api/auth/callback/facebook`. Apps in
development mode only let you and roles you add sign in — go to App Review
if you want the whole league to use it, though for a small private pool it's
usually simplest to just add each friend as a "Tester" under App Roles.

## 5. Payments: manual for now, Stripe later

You chose manual dues tracking to start — the Commissioner page has a "Paid"
checkbox per member so you can mark folks off as they Venmo/Zelle/hand you
cash. No fees, no merchant account, nothing to maintain.

If you later want to collect dues *through* the site, here's the shape that
work would take:

1. **Stripe Checkout, not a raw card form.** You'd create a Stripe account,
   add a "Buy in" button that calls `stripe.checkout.sessions.create()` with
   a fixed price equal to the league's buy-in, redirecting the member to
   Stripe's hosted payment page (Stripe holds all card data, so you stay out
   of PCI scope).
2. **A webhook endpoint** (`/api/stripe/webhook`) that listens for
   `checkout.session.completed` and flips `membership.paid = true`
   automatically — replacing the manual checkbox.
3. **Payouts**: Stripe collects the money into *your* Stripe balance, not
   directly to the winner. To pay the winner, you'd manually transfer/Venmo
   them from your own payout, or set up Stripe Connect so the league itself
   has a payout destination — more setup, only worth it if you're running
   multiple leagues or want to be hands-off.
4. **Legal/tax note**: collecting money for a prize pool from friends is
   generally treated like any other office pool, but rules vary by state and
   this isn't legal advice — worth a quick check if the pool gets large.

Happy to build the Stripe integration when you're ready — it's a self-contained
add-on to this codebase (roughly: a `Membership.stripePaymentIntentId` column,
one checkout-session route, one webhook route).

## 6. League rules & assumptions baked into this build

- **Weekly lock**: the whole week locks at the *first* kickoff of that week
  (`LockRule.FIRST_KICKOFF`, the default), so nobody can wait to see Sunday's
  early games before locking in a Sunday-night or Monday pick. If you'd
  rather let people pick a later game after seeing earlier results, change a
  league's `lockRule` to `PER_GAME` (each team locks at its own kickoff) —
  there's no UI for this yet, it's a one-row update in the `League` table.
- **Missed picks**: auto-assigned to the biggest point-spread favorite among
  that player's remaining, unused teams (falls back to *any* remaining team,
  ordered by kickoff time, if odds haven't synced yet).
- **Ties**: count as a win (you advance), per NFL survivor-pool convention.
- **Multiple survivors when the season ends**: not handled automatically —
  since the regular season is fixed-length, if more than one player is still
  alive after Week 18 there's no natural "last one standing." Decide up front
  whether that means a split pot or a tiebreaker week using each remaining
  player's best unused team, and have the commissioner resolve it manually
  from the Standings page.
- **Everyone eliminated in the same week**: the pot splits among whoever was
  still alive going into that week (shown as `SPLIT_NO_SURVIVORS` in the
  sync job's output) — again, payout is a manual step for the commissioner.

## 7. NFL logos

Team logos are pulled from ESPN's public CDN (`a.espncdn.com`). This is the
same widely-used approach other hobby fantasy sites take, but note team
logos/names are NFL trademarks — fine for a private, non-commercial friends
league; if this ever became a paid public product you'd want your own
licensing review.

## 8. Local development

```bash
npm install
docker run -d -p 5432:5432 -e POSTGRES_USER=survivor -e POSTGRES_PASSWORD=survivor -e POSTGRES_DB=survivor_pool postgres:16-alpine
cp .env.example .env   # DATABASE_URL already matches the above
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```
