import { prisma } from './prisma'
import { sendMail, emailTemplates } from './email'

/**
 * Auto-pick logic for members who didn't submit a pick before lock.
 * Rule (per league settings): assign the biggest point-spread favorite
 * among the member's remaining *eligible* teams (teams they haven't
 * already used) that plays this week. Falls back to the largest existing
 * game (as a proxy for "most likely to be a comfortable favorite") if no
 * spread data has been synced yet.
 */
export async function autoPickForMembership(membershipId: string, season: number, week: number) {
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { id: membershipId },
    include: { user: true, league: true, picks: true },
  })

  if (membership.eliminated) return null

  const alreadyPicked = new Set(membership.picks.map((p: { teamId: string }) => p.teamId))

  type TeamRow = { id: string; city: string; name: string }
  type GameRow = {
    kickoff: Date
    spread: number | null
    homeTeamId: string
    awayTeamId: string
    favoriteTeamId: string | null
    homeTeam: TeamRow
    awayTeam: TeamRow
  }

  const gamesThisWeek: GameRow[] = await prisma.game.findMany({
    where: { season, week },
    include: { homeTeam: true, awayTeam: true, favoriteTeam: true },
  })

  type Candidate = { teamId: string; teamName: string; spread: number }
  const candidates: Candidate[] = []

  for (const game of gamesThisWeek) {
    for (const side of [
      { team: game.homeTeam, isFavorite: game.favoriteTeamId === game.homeTeamId },
      { team: game.awayTeam, isFavorite: game.favoriteTeamId === game.awayTeamId },
    ]) {
      if (alreadyPicked.has(side.team.id)) continue
      if (!side.isFavorite) continue
      candidates.push({
        teamId: side.team.id,
        teamName: `${side.team.city} ${side.team.name}`,
        spread: game.spread ?? 0,
      })
    }
  }

  // No spread data synced yet for any eligible favorite — fall back to any
  // remaining eligible team (first by kickoff time) so the member still gets
  // *a* pick rather than being unfairly auto-eliminated.
  if (candidates.length === 0) {
    for (const game of gamesThisWeek.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())) {
      for (const team of [game.homeTeam, game.awayTeam]) {
        if (!alreadyPicked.has(team.id)) {
          candidates.push({ teamId: team.id, teamName: `${team.city} ${team.name}`, spread: 0 })
        }
      }
      if (candidates.length > 0) break
    }
  }

  if (candidates.length === 0) return null // no eligible teams left at all

  candidates.sort((a, b) => b.spread - a.spread)
  const chosen = candidates[0]

  const pick = await prisma.pick.create({
    data: {
      membershipId,
      leagueId: membership.leagueId,
      teamId: chosen.teamId,
      season,
      week,
      isAutoPick: true,
    },
  })

  if (membership.user.email) {
    await sendMail(
      membership.user.email,
      `We picked for you — Week ${week}`,
      emailTemplates.autoPickAssigned(membership.user.name ?? 'there', week, chosen.teamName)
    )
  }

  return pick
}

/** Run auto-pick for every non-eliminated member of a league still missing a pick for the week. */
export async function autoPickMissingForLeague(leagueId: string, season: number, week: number) {
  const memberships = await prisma.membership.findMany({
    where: { leagueId, eliminated: false },
    include: { picks: { where: { week } } },
  })
  const results = []
  for (const m of memberships) {
    if (m.picks.length === 0) {
      results.push(await autoPickForMembership(m.id, season, week))
    }
  }
  return results
}
