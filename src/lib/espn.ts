// Thin client around ESPN's public (unofficial, no API key required) NFL
// scoreboard endpoint. This is the same data ESPN.com itself renders from,
// and is widely used by hobby projects for schedule/score/odds data.
// Docs are unofficial; endpoint shape can change without notice, so all
// fields are read defensively.

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

export interface EspnGame {
  espnId: string
  kickoff: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL'
  homeTeamEspnId: string
  awayTeamEspnId: string
  homeScore: number | null
  awayScore: number | null
  favoriteTeamEspnId: string | null
  spread: number | null
}

function mapStatus(state: string): EspnGame['status'] {
  if (state === 'post') return 'FINAL'
  if (state === 'in') return 'IN_PROGRESS'
  return 'SCHEDULED'
}

export async function fetchWeekScoreboard(season: number, week: number, seasonType = 2): Promise<EspnGame[]> {
  const url = `${BASE}/scoreboard?year=${season}&seasontype=${seasonType}&week=${week}`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`ESPN scoreboard fetch failed: ${res.status}`)
  const data = await res.json()

  // ESPN's scoreboard endpoint doesn't error for a season/week it has no
  // schedule for yet (e.g. querying a regular-season week before that
  // season's schedule is fully populated) — it silently falls back to
  // unrelated data instead (observed: requesting the not-yet-scheduled 2026
  // week 1 returned the real, already-final 2025 week 1). The response
  // self-reports what it actually served, so cross-check that against what
  // we asked for and refuse to ingest a mismatch rather than silently
  // corrupting Game rows with the wrong season's results.
  if (data.season?.year !== season || data.week?.number !== week) {
    throw new Error(
      `ESPN returned season ${data.season?.year} week ${data.week?.number} instead of the requested ` +
      `season ${season} week ${week} — refusing to ingest mismatched data`
    )
  }

  const games: EspnGame[] = []
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0]
    if (!comp) continue
    const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
    const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
    if (!home || !away) continue

    let favoriteTeamEspnId: string | null = null
    let spread: number | null = null
    const odds = comp.odds?.[0]
    if (odds?.details) {
      // details look like "KC -3.5" or "EVEN"
      const match = /(-?\d+(\.\d+)?)/.exec(odds.details)
      if (match) {
        spread = Math.abs(parseFloat(match[1]))
        const favAbbrev = odds.details.split(' ')[0]
        if (home.team.abbreviation === favAbbrev) favoriteTeamEspnId = home.team.id
        else if (away.team.abbreviation === favAbbrev) favoriteTeamEspnId = away.team.id
      }
    } else if (typeof odds?.spread === 'number') {
      spread = Math.abs(odds.spread)
      favoriteTeamEspnId = odds.spread < 0 ? home.team.id : away.team.id
    }

    games.push({
      espnId: event.id,
      kickoff: event.date,
      status: mapStatus(comp.status?.type?.state ?? 'pre'),
      homeTeamEspnId: home.team.id,
      awayTeamEspnId: away.team.id,
      homeScore: home.score !== undefined ? Number(home.score) : null,
      awayScore: away.score !== undefined ? Number(away.score) : null,
      favoriteTeamEspnId,
      spread,
    })
  }
  return games
}

// Simple fallback favorite estimator when no spread data is available yet
// (e.g. very early in the week): favors the team with the better win pct
// using standings pulled from the same scoreboard payload's records, or
// falls back to home-field advantage as a last resort.
export function pickFallbackFavorite(
  homeRecord: { wins: number; losses: number; ties: number } | null,
  awayRecord: { wins: number; losses: number; ties: number } | null
): 'home' | 'away' {
  const pct = (r: { wins: number; losses: number; ties: number } | null) => {
    if (!r) return 0.5
    const total = r.wins + r.losses + r.ties
    return total === 0 ? 0.5 : (r.wins + r.ties * 0.5) / total
  }
  const homePct = pct(homeRecord)
  const awayPct = pct(awayRecord)
  if (homePct === awayPct) return 'home' // slight home-field tiebreak
  return homePct > awayPct ? 'home' : 'away'
}
