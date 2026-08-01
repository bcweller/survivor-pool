import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { inviteCode } = body ?? {}
  if (!inviteCode) return NextResponse.json({ error: 'inviteCode is required' }, { status: 400 })

  const league = await prisma.league.findUnique({ where: { inviteCode } })
  if (!league) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })

  const membership = await prisma.membership.upsert({
    where: { userId_leagueId: { userId: (session.user as any).id, leagueId: league.id } },
    update: {},
    create: { userId: (session.user as any).id, leagueId: league.id },
  })

  return NextResponse.json(membership)
}
