'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { BASE_PATH } from '@/lib/basePath'

type Pick = {
  week: number
  team: string
  abbreviation: string
  logoUrl: string
  result: 'PENDING' | 'WIN' | 'LOSS' | 'TIE_ADVANCE'
  isAutoPick: boolean
}

type StandingsMember = {
  id: string
  name: string | null
  eliminated: boolean
  eliminatedWeek: number | null
  picks: Pick[]
}

type Standings = {
  aliveCount: number
  weeks: number[]
  champion: { name: string | null } | null
  members: StandingsMember[]
}

// Cell background by pick outcome — survived (green), lost (red), not yet
// decided (blue, still in progress), vs. a week the player wasn't even in
// the pool for anymore (grey, no border, visually "faded out").
const RESULT_STYLE: Record<Pick['result'], string> = {
  WIN: 'bg-green-900/50 border-green-500/50',
  TIE_ADVANCE: 'bg-green-900/50 border-green-500/50',
  LOSS: 'bg-red-900/50 border-red-500/50',
  PENDING: 'bg-blue-900/40 border-blue-500/40',
}

export default function StandingsPage() {
  const { data: session } = useSession()
  const [memberships, setMemberships] = useState<any[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [data, setData] = useState<Standings | null>(null)

  useEffect(() => {
    if (!session) return
    fetch(`${BASE_PATH}/api/leagues`).then((r) => r.json()).then((ms) => {
      setMemberships(ms)
      if (ms.length > 0) setLeagueId(ms[0].leagueId)
    })
  }, [session])

  const load = useCallback(async () => {
    if (!leagueId) return
    const res = await fetch(`${BASE_PATH}/api/leagues/${leagueId}/standings`)
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

      {data && data.weeks.length === 0 && (
        <p className="text-gray-400">No games synced yet this season — picks will show up here once weeks are underway.</p>
      )}

      {data && data.weeks.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-gridiron-800 text-left px-3 py-2 text-gray-400 font-medium border-b border-gridiron-700">
                  Player
                </th>
                {data.weeks.map((w) => (
                  <th key={w} className="px-1 py-2 text-gray-400 font-medium border-b border-gridiron-700 min-w-[52px]">
                    Wk{w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="border-b border-gridiron-700/60 last:border-0">
                  <td className="sticky left-0 z-10 bg-gridiron-800 px-3 py-2 whitespace-nowrap">
                    <span className={m.eliminated ? 'text-gray-500 line-through' : 'text-white font-medium'}>
                      {m.name}
                    </span>
                  </td>
                  {data.weeks.map((w) => {
                    const pick = m.picks.find((p) => p.week === w)
                    const didNotPlay = !pick && m.eliminatedWeek != null && w > m.eliminatedWeek
                    return (
                      <td key={w} className="px-1 py-1 text-center">
                        {pick ? (
                          <div
                            title={`${pick.team}${pick.isAutoPick ? ' (auto-pick)' : ''}`}
                            className={`relative mx-auto flex h-11 w-11 items-center justify-center rounded-md border ${RESULT_STYLE[pick.result]}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={pick.logoUrl} alt={pick.abbreviation} className="h-7 w-7" />
                            {pick.isAutoPick && (
                              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-yellow-400 border border-gridiron-900" />
                            )}
                          </div>
                        ) : didNotPlay ? (
                          <div className="mx-auto h-11 w-11 rounded-md bg-gray-700/20" />
                        ) : (
                          <div className="mx-auto h-11 w-11" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
