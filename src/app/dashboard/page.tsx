'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BASE_PATH } from '@/lib/basePath'

type Membership = {
  id: string
  leagueId: string
  eliminated: boolean
  paid: boolean
  isCommissioner: boolean
  league: { id: string; name: string; season: number; inviteCode: string }
}

type Team = {
  id: string
  name: string
  city: string
  abbreviation: string
  logoUrl: string
  gameId: string
  kickoff: string
  opponent: string
  spread: number | null
  isFavorite: boolean
  eligible: boolean
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [memberships, setMemberships] = useState<Membership[]>([])
  const [leagueId, setLeagueId] = useState<string>('')
  const [week, setWeek] = useState<number | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [locked, setLocked] = useState(false)
  const [currentPickTeamId, setCurrentPickTeamId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const [newLeagueName, setNewLeagueName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadMemberships = useCallback(async () => {
    const res = await fetch(`${BASE_PATH}/api/leagues`)
    if (res.ok) {
      const data = await res.json()
      setMemberships(data)
      if (data.length > 0 && !leagueId) setLeagueId(data[0].leagueId)
    }
  }, [leagueId])

  useEffect(() => { if (session) loadMemberships() }, [session, loadMemberships])

  const loadPicks = useCallback(async () => {
    if (!leagueId) return
    // No week param — the server auto-detects the current pickable week
    // (the latest one with synced games) since there's no manual selector.
    const res = await fetch(`${BASE_PATH}/api/picks?leagueId=${leagueId}`)
    if (res.ok) {
      const data = await res.json()
      setWeek(data.week)
      setTeams(data.teams)
      setLocked(data.locked)
      setCurrentPickTeamId(data.currentPick?.teamId ?? null)
    }
  }, [leagueId])

  useEffect(() => { loadPicks() }, [loadPicks])

  async function submitPick(teamId: string) {
    if (!week) return
    setMessage(null)
    const res = await fetch(`${BASE_PATH}/api/picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, week, teamId }),
    })
    const data = await res.json()
    if (!res.ok) setMessage(data.error)
    else { setMessage('Pick saved!'); loadPicks() }
  }

  async function joinLeague() {
    const res = await fetch(`${BASE_PATH}/api/leagues/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    })
    if (res.ok) { setInviteCode(''); loadMemberships() } else setMessage((await res.json()).error)
  }

  async function createLeague() {
    const res = await fetch(`${BASE_PATH}/api/leagues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newLeagueName, season: new Date().getFullYear(), buyInCents: 0 }),
    })
    if (res.ok) { setNewLeagueName(''); loadMemberships() } else setMessage((await res.json()).error)
  }

  if (status === 'loading') return <p className="text-gray-400">Loading…</p>

  const currentMembership = memberships.find((m) => m.leagueId === leagueId)

  return (
    <div className="space-y-8">
      {memberships.length === 0 && (
        <div className="card p-6 space-y-4">
          <h2 className="font-bold text-white">You&rsquo;re not in a league yet</h2>
          <div className="flex gap-2">
            <input className="input" placeholder="Invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
            <button className="btn-primary" onClick={joinLeague}>Join</button>
          </div>
          <div className="flex gap-2">
            <input className="input" placeholder="New league name" value={newLeagueName} onChange={(e) => setNewLeagueName(e.target.value)} />
            <button className="btn-secondary" onClick={createLeague}>Create league</button>
          </div>
        </div>
      )}

      {memberships.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <select className="input w-auto" value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
              {memberships.map((m) => <option key={m.leagueId} value={m.leagueId}>{m.league.name}</option>)}
            </select>
            {week && <span className="font-semibold text-white">Week {week}</span>}
            {currentMembership?.eliminated && <span className="text-red-400 font-semibold">You&rsquo;ve been eliminated</span>}
            {currentMembership && !currentMembership.paid && (
              <span className="text-yellow-400 text-sm">Dues not yet marked paid by commissioner</span>
            )}
          </div>

          {locked && <p className="text-sm text-yellow-400">Picks are locked for Week {week}.</p>}
          {message && <p className="text-sm text-accent">{message}</p>}

          {!week && (
            <p className="text-gray-400">No games scheduled yet for this season — check back once the schedule is synced.</p>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((t) => (
              <button
                key={t.id}
                disabled={!t.eligible || locked || currentMembership?.eliminated}
                onClick={() => submitPick(t.id)}
                className={`card p-4 flex items-center gap-3 text-left transition ${
                  currentPickTeamId === t.id ? 'ring-2 ring-accent' : ''
                } ${!t.eligible ? 'opacity-30 cursor-not-allowed' : 'hover:border-accent'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.logoUrl} alt={t.abbreviation} className="h-10 w-10" />
                <div>
                  <p className="font-semibold text-white">{t.city} {t.name}</p>
                  <p className="text-xs text-gray-400">
                    vs {t.opponent} {t.isFavorite && t.spread ? `· favored by ${t.spread}` : ''}
                    {!t.eligible ? ' · already used' : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
