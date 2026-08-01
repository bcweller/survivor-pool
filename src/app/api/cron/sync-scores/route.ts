import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchWeekScoreboard } from '@/lib/espn'
import { settleWeek } from '@/lib/rules'
import { autoPickMissingForLeague } from '@/lib/autopick'
import { computeWeekLockTime } from '@/lib/rules'

/**
 * Pulls the latest schedule/scores/spreads from ESPN for a given season+week,
 * upserts them into the DB, settles any newly-final games (marking picks
 * WIN/LOSS and eliminating losers), and auto-picks for anyone who missed the
 * lock. Intended to be hit by a system cron (e.g. every 15 min on game days).
 *
 * Auth: requires `?secret=CRON_SECRET` (or header `x-cron-secret`) matching
 * the CRON_SECRET env var.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const season = Number(searchParams.get('season') || process.env.CURRENT_SEASON)
  const week = Number(searchParams.get('week'))
  if (!season || !week) return NextResponse.json({ error: 'season and week are required' }, { status: 400 })

  const espnGames = await fetchWeekScoreboard(season, week)
  const teams: { id: string; espnId: string }[] = await prisma.team.findMany()
  const teamByEspnId = new Map(teams.map((t) => [t.espnId, t]))

  let upserted = 0
  for (const g of espnGames) {
    const home = teamByEspnId.get(g.homeTeamEspnId)
    const away = teamByEspnId.get(g.awayTeamEspnId)
    if (!home || !away) continue
    const favorite = g.favoriteTeamEspnId ? teamByEspnId.get(g.favoriteTeamEspnId) : null

    await prisma.game.upsert({
      where: { espnId: g.espnId },
      update: {
        status: g.status,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        favoriteTeamId: favorite?.id,
        spread: g.spread,
        kickoff: new Date(g.kickoff),
      },
      create: {
        espnId: g.espnId,
        season,
        week,
        kickoff: new Date(g.kickoff),
        status: g.status,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        favoriteTeamId: favorite?.id,
        spread: g.spread,
      },
    })
    upserted++
  }

  const leagues = await prisma.league.findMany({ where: { season, isArchived: false } })
  const settlements = []
  const autoPicks = []

  const games = await prisma.game.findMany({ where: { season, week } })

  for (const league of leagues) {
    const lockTime = computeWeekLockTime(games, league.lockRule)
    if (lockTime && new Date() >= lockTime) {
      autoPicks.push({ leagueId: league.id, results: await autoPickMissingForLeague(league.id, season, week) })
    }
    settlements.push({ leagueId: league.id, result: await settleWeek(league.id, season, week) })
  }

  return NextResponse.json({ upserted, settlements, autoPicks })
}
