import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { leagueId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await prisma.membership.findUnique({
    where: { userId_leagueId: { userId: (session.user as any).id, leagueId: params.leagueId } },
  })
  if (!membership) return NextResponse.json({ error: 'Not a member of this league' }, { status: 403 })

  const league = await prisma.league.findUniqueOrThrow({ where: { id: params.leagueId } })
  const members = await prisma.membership.findMany({
    where: { leagueId: params.leagueId },
    // select only safe User fields — never passwordHash — since `champion`
    // below returns one of these records straight to the client.
    include: {
      user: { select: { name: true } },
      picks: { include: { team: true }, orderBy: { week: 'asc' } },
    },
    orderBy: [{ eliminated: 'asc' }, { eliminatedWeek: 'desc' }],
  })
  const games = await prisma.game.findMany({ where: { season: league.season }, select: { week: true } })

  type MemberRow = {
    id: string
    eliminated: boolean
    eliminatedWeek: number | null
    user: { name: string | null }
    picks: {
      week: number
      result: string
      isAutoPick: boolean
      team: { city: string; name: string; abbreviation: string; logoUrl: string }
    }[]
  }
  const typedMembers = members as MemberRow[]

  const aliveCount = typedMembers.filter((m) => !m.eliminated).length

  // Full set of weeks to show as grid columns — every week with synced
  // games, plus any week someone has a pick for (belt and suspenders in
  // case a week's games were ever removed after picks were made).
  const weekSet = new Set<number>(games.map((g) => g.week))
  for (const m of typedMembers) for (const p of m.picks) weekSet.add(p.week)
  const weeks = [...weekSet].sort((a, b) => a - b)

  // Build the safe, client-facing shape once and derive champion from it —
  // never return a raw membership/user record, which would leak fields like
  // passwordHash (Prisma's `include: { user: true }` above pulls every
  // User column, not just name).
  const safeMembers = typedMembers.map((m) => ({
    id: m.id,
    name: m.user.name,
    eliminated: m.eliminated,
    eliminatedWeek: m.eliminatedWeek,
    picks: m.picks.map((p) => ({
      week: p.week,
      team: `${p.team.city} ${p.team.name}`,
      abbreviation: p.team.abbreviation,
      logoUrl: p.team.logoUrl,
      result: p.result,
      isAutoPick: p.isAutoPick,
    })),
  }))

  return NextResponse.json({
    league,
    aliveCount,
    weeks,
    champion: aliveCount === 1 ? safeMembers.find((m) => !m.eliminated) : null,
    members: safeMembers,
  })
}
