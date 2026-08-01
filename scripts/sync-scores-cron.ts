// Standalone script meant to be invoked by system cron on the Ubuntu server,
// e.g.: */15 * * * * cd /opt/survivor-pool && npm run sync:scores >> /var/log/survivor-pool-sync.log 2>&1
//
// It figures out the current NFL week directly from ESPN's own scoreboard
// (which defaults to "this week" when called with no week/year params), then
// hits our app's own /api/cron/sync-scores endpoint for that week so all the
// real settlement logic runs inside the running Next.js server/process.

const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET

async function main() {
  if (!CRON_SECRET) {
    console.error('CRON_SECRET is not set in the environment.')
    process.exit(1)
  }

  const scoreboardRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard')
  if (!scoreboardRes.ok) throw new Error(`ESPN scoreboard lookup failed: ${scoreboardRes.status}`)
  const scoreboard = await scoreboardRes.json()

  const week = scoreboard?.week?.number
  const season = scoreboard?.season?.year
  if (!week || !season) throw new Error('Could not determine current NFL week/season from ESPN response')

  const url = `${APP_URL}/api/cron/sync-scores?season=${season}&week=${week}&secret=${CRON_SECRET}`
  const res = await fetch(url)
  const body = await res.json()
  console.log(`[sync-scores] season=${season} week=${week} status=${res.status}`, JSON.stringify(body))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
