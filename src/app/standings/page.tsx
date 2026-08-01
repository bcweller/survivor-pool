'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

type StandingsMember = {
  id: string
  name: string | null
  eliminated: boolean
  eliminatedWeek: number | null
  picks: { week: number; team: string; result: string; isAutoPick: boolean }[]
}

export default function StandingsPage() {
  const { data: session } = useSession()
  const [memberships, setMemberships] = useState<any[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [data, setData] = useState<{ aliveCount: number; champion: any; members: StandingsMember[] } | null>(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/leagues').then((r) => r.json()).then((ms) => {
      setMemberships(ms)
      if (ms.length > 0) setLeagueId(ms[0].leagueId)
    })
  }, [session])

  const load = useCallback(async () => {
    if (!leagueId) return
    const res = await fetch(`/api/leagues/${leagueId}/standings`)
    if (res.ok) setData(await res.json())
  }, [leagueId])

  useEffect(() => { load() }, [load])

  if (!session) return <p className="text-gray-400">Sign in to view standings.</p>

  return (
    <div className="space-y-6">
      {memberships.length > 1 && (
        <select className="input w-auto" value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
          {memberships.map((m) => <option key={m.leagueId} value={m.leagueId}>{m.league.name}</option>)}
        </select>
      )}

      {data?.champion && (
        <div className="card p-6 bg-accent/10 border-accent">
          <p className="text-accent font-bold">🏆 {data.champion.name} is the last one standing!</p>
        </div>
      )}

      {data && (
        <p className="text-gray-400 text-sm">{data.aliveCount} player{data.aliveCount === 1 ? '' : 's'} still alive</p>
      )}

      <div className="card divide-y divide-gridiron-700">
        {data?.members.map((m) => (
          <div key={m.id} className="p-4 flex items-center justify-between">
            <div>
              <p className={`font-semibold ${m.eliminated ? 'text-gray-500 line-through' : 'text-white'}`}>{m.name}</p>
              <p className="text-xs text-gray-500">
                {m.picks.map((p) => `W${p.week}: ${p.team}${p.isAutoPick ? ' (auto)' : ''}`).join(' · ')}
              </p>
            </div>
            <span className={`text-sm font-semibold ${m.eliminated ? 'text-red-400' : 'text-accent'}`}>
              {m.eliminated ? `Out (Wk ${m.eliminatedWeek})` : 'Alive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
