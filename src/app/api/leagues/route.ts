import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await prisma.membership.findMany({
    where: { userId: (session.user as any).id },
    include: { league: true },
  })
  return NextResponse.json(memberships)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { name, season, buyInCents, lockRule } = body ?? {}
  if (!name || !season) return NextResponse.json({ error: 'name and season are required' }, { status: 400 })

  const inviteCode = randomBytes(4).toString('hex')

  const league = await prisma.league.create({
    data: {
      name,
      season: Number(season),
      buyInCents: Number(buyInCents) || 0,
      lockRule: lockRule === 'PER_GAME' ? 'PER_GAME' : 'FIRST_KICKOFF',
      inviteCode,
      memberships: {
        create: { userId: (session.user as any).id, isCommissioner: true, paid: true },
      },
    },
  })

  return NextResponse.json(league)
}
