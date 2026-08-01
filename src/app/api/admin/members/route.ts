import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireCommissioner(userId: string, leagueId: string) {
  const membership = await prisma.membership.findUnique({ where: { userId_leagueId: { userId, leagueId } } })
  return membership?.isCommissioner ? membership : null
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const leagueId = searchParams.get('leagueId')
  if (!leagueId) return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })

  const commish = await requireCommissioner((session.user as any).id, leagueId)
  if (!commish) return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 })

  const members = await prisma.membership.findMany({
    where: { leagueId },
    // select only safe User fields — never passwordHash — since this is
    // returned to the client as-is below.
    include: {
      user: { select: { name: true, email: true } },
      picks: { include: { team: true }, orderBy: { week: 'asc' } },
    },
    orderBy: { joinedAt: 'asc' },
  })
  return NextResponse.json(members)
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { leagueId, membershipId, paid, eliminated } = body ?? {}
  if (!leagueId || !membershipId) {
    return NextResponse.json({ error: 'leagueId and membershipId are required' }, { status: 400 })
  }

  const commish = await requireCommissioner((session.user as any).id, leagueId)
  if (!commish) return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 })

  const data: Record<string, unknown> = {}
  if (typeof paid === 'boolean') { data.paid = paid; data.paidAt = paid ? new Date() : null }
  if (typeof eliminated === 'boolean') data.eliminated = eliminated

  const updated = await prisma.membership.update({ where: { id: membershipId }, data })
  return NextResponse.json(updated)
}
