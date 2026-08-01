import { prisma } from './prisma'
import { sendMail, emailTemplates } from './email'

// Mirrors the Prisma `LockRule` enum (kept as a plain string union here so
// this file has no compile-time dependency on the generated Prisma client).
export type LockRule = 'FIRST_KICKOFF' | 'PER_GAME'

/** Returns the Date at which picks lock for a given week, per the league's lock rule. */
export function computeWeekLockTime(
  games: { kickoff: Date; homeTeamId: string; awayTeamId: string }[],
  lockRule: LockRule,
  teamId?: string
): Date | null {
  if (games.length === 0) return null
  if (lockRule === 'FIRST_KICKOFF') {
    return games.reduce((earliest, g) => (g.kickoff < earliest ? g.kickoff : earliest), games[0].kickoff)
  }
  // PER_GAME: lock is that specific team's own kickoff
  const g = games.find((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
  return g ? g.kickoff : null
}

/**
 * Settle all FINAL games for a week: mark each pick WIN / LOSS / TIE_ADVANCE,
 * eliminate members whose team lost, and email results. Idempotent — safe to
 * call repeatedly (e.g. from a polling cron) as it only updates PENDING picks
 * whose game has finished.
 */
export async function settleWeek(leagueId: string, season: number, week: number) {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } })

  const picks = await prisma.pick.findMany({
    where: { leagueId, season, week, result: 'PENDING' },
    include: {
      team: true,
      membership: { include: { user: true } },
    },
  })

  const summary: { membershipId: string; result: string }[] = []

  for (const pick of picks) {
    const game = await prisma.game.findFirst({
      where: {
        season,
        week,
        status: 'FINAL',
        OR: [{ homeTeamId: pick.teamId }, { awayTeamId: pick.teamId }],
      },
    })
    if (!game || game.homeScore === null || game.awayScore === null) continue // not final yet

    const teamIsHome = game.homeTeamId === pick.teamId
    const teamScore = teamIsHome ? game.homeScore : game.awayScore
    const oppScore = teamIsHome ? game.awayScore : game.homeScore

    const result = teamScore > oppScore ? 'WIN' : teamScore === oppScore ? 'TIE_ADVANCE' : 'LOSS'
    const survived = result !== 'LOSS'

    await prisma.pick.update({ where: { id: pick.id }, data: { result } })

    if (!survived) {
      await prisma.membership.update({
        where: { id: pick.membershipId },
        data: { eliminated: true, eliminatedWeek: week },
      })
    }

    if (pick.membership.user.email) {
      await sendMail(
        pick.membership.user.email,
        survived ? `You survived Week ${week}!` : `Eliminated in Week ${week}`,
        emailTemplates.weekResult(pick.membership.user.name ?? 'there', week, `${pick.team.city} ${pick.team.name}`, survived)
      )
    }

    summary.push({ membershipId: pick.membershipId, result })
  }

  // Check for a champion / season-ending split.
  const remaining = await prisma.membership.findMany({ where: { leagueId, eliminated: false } })
  let outcome: 'ONGOING' | 'CHAMPION' | 'SPLIT_NO_SURVIVORS' | null = null
  if (remaining.length === 1) outcome = 'CHAMPION'
  if (remaining.length === 0) outcome = 'SPLIT_NO_SURVIVORS' // everyone lost the same week -> pot splits among that week's players, per league rules

  return { settled: summary, remainingCount: remaining.length, outcome, league }
}
