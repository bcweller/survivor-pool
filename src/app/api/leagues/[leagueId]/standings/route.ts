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
    include: { user: true, picks: { include: { team: true }, orderBy: { week: 'asc' } } },
    orderBy: [{ eliminated: 'asc' }, { eliminatedWeek: 'desc' }],
  })

  type MemberRow = {
    id: string
    eliminated: boolean
    eliminatedWeek: number | null
    user: { name: string | null }
    picks: { week: number; result: string; isAutoPick: boolean; team: { city: string; name: string } }[]
  }
  const typedMembers = members as MemberRow[]

  const aliveCount = typedMembers.filter((m) => !m.eliminated).length

  return NextResponse.json({
    league,
    aliveCount,
    champion: aliveCount === 1 ? typedMembers.find((m) => !m.eliminated) : null,
    members: typedMembers.map((m) => ({
      id: m.id,
      name: m.user.name,
      eliminated: m.eliminated,
      eliminatedWeek: m.eliminatedWeek,
      picks: m.picks.map((p) => ({ week: p.week, team: `${p.team.city} ${p.team.name}`, result: p.result, isAutoPick: p.isAutoPick })),
    })),
  })
}
