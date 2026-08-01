import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeWeekLockTime } from '@/lib/rules'
import { sendMail, emailTemplates } from '@/lib/email'

async function getMembership(userId: string, leagueId: string) {
  return prisma.membership.findUnique({ where: { userId_leagueId: { userId, leagueId } } })
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  const week = Number(searchParams.get('week'))
  if (!leagueId || !week) return NextResponse.json({ error: 'leagueId and week are required' }, { status: 400 })

  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } })
  const membership = await getMembership((session.user as any).id, leagueId)
  if (!membership) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 })

  const [games, myPicks, existingPick] = await Promise.all([
    prisma.game.findMany({
      where: { season: league.season, week },
      include: { homeTeam: true, awayTeam: true, favoriteTeam: true },
      orderBy: { kickoff: 'asc' },
    }),
    prisma.pick.findMany({ where: { membershipId: membership.id } }),
    prisma.pick.findFirst({ where: { membershipId: membership.id, week } }),
  ])

  const usedTeamIds = new Set(myPicks.map((p: { teamId: string }) => p.teamId))
  const lockTime = computeWeekLockTime(games, league.lockRule)
  const locked = lockTime ? new Date() >= lockTime : false

  type GameWithTeams = {
    id: string
    kickoff: Date
    spread: number | null
    homeTeamId: string
    awayTeamId: string
    favoriteTeamId: string | null
    homeTeam: { id: string; abbreviation: string; [key: string]: unknown }
    awayTeam: { id: string; abbreviation: string; [key: string]: unknown }
  }

  const teams = (games as GameWithTeams[]).flatMap((g) => [
    { ...g.homeTeam, gameId: g.id, kickoff: g.kickoff, opponent: g.awayTeam.abbreviation, spread: g.spread, isFavorite: g.favoriteTeamId === g.homeTeamId },
    { ...g.awayTeam, gameId: g.id, kickoff: g.kickoff, opponent: g.homeTeam.abbreviation, spread: g.spread, isFavorite: g.favoriteTeamId === g.awayTeamId },
  ]).map((t) => ({ ...t, eligible: !usedTeamIds.has(t.id as string) }))

  return NextResponse.json({
    eliminated: membership.eliminated,
    lockTime,
    locked,
    lockRule: league.lockRule,
    currentPick: existingPick,
    teams,
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { leagueId, week, teamId } = body ?? {}
  if (!leagueId || !week || !teamId) {
    return NextResponse.json({ error: 'leagueId, week, teamId are required' }, { status: 400 })
  }

  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } })
  const membership = await getMembership((session.user as any).id, leagueId)
  if (!membership) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 })
  if (membership.eliminated) return NextResponse.json({ error: 'You have already been eliminated' }, { status: 403 })

  const games = await prisma.game.findMany({ where: { season: league.season, week } })
  const lockTime = computeWeekLockTime(games, league.lockRule, teamId)
  if (lockTime && new Date() >= lockTime) {
    return NextResponse.json({ error: 'Picks are locked for this week' }, { status: 403 })
  }

  const alreadyUsed = await prisma.pick.findUnique({
    where: { membershipId_teamId: { membershipId: membership.id, teamId } },
  })
  if (alreadyUsed) {
    return NextResponse.json({ error: 'You have already used that team this season' }, { status: 409 })
  }

  const pick = await prisma.pick.upsert({
    where: { membershipId_week: { membershipId: membership.id, week } },
    update: { teamId, isAutoPick: false },
    create: { membershipId: membership.id, leagueId, teamId, season: league.season, week },
    include: { team: true },
  })

  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id } })
  if (user?.email) {
    await sendMail(
      user.email,
      `Pick locked in for Week ${week}`,
      emailTemplates.pickConfirmation(user.name ?? 'there', week, `${pick.team.city} ${pick.team.name}`)
    )
  }

  return NextResponse.json(pick)
}
