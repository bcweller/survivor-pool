'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export default function AdminPage() {
  const { data: session } = useSession()
  const [memberships, setMemberships] = useState<any[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    fetch('/api/leagues').then((r) => r.json()).then((ms) => {
      const commish = ms.filter((m: any) => m.isCommissioner)
      setMemberships(commish)
      if (commish.length > 0) setLeagueId(commish[0].leagueId)
    })
  }, [session])

  const load = useCallback(async () => {
    if (!leagueId) return
    const res = await fetch(`/api/admin/members?leagueId=${leagueId}`)
    if (res.ok) setMembers(await res.json())
    else setError((await res.json()).error)
  }, [leagueId])

  useEffect(() => { load() }, [load])

  async function update(membershipId: string, patch: Record<string, unknown>) {
    await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, membershipId, ...patch }),
    })
    load()
  }

  const league = memberships.find((m) => m.leagueId === leagueId)?.league

  if (!session) return <p className="text-gray-400">Sign in to manage your league.</p>
  if (memberships.length === 0) return <p className="text-gray-400">You&rsquo;re not a commissioner of any league yet.</p>

  return (
    <div className="space-y-6">
      <select className="input w-auto" value={leagueId} onChange={(e) => setLeagueId(e.target.value)}>
        {memberships.map((m) => <option key={m.leagueId} value={m.leagueId}>{m.league.name}</option>)}
      </select>

      {league && (
        <div className="card p-4 text-sm text-gray-300">
          Invite code: <code className="text-accent">{league.inviteCode}</code> · Buy-in: ${(league.buyInCents / 100).toFixed(2)} · Season {league.season}
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}

      <div className="card divide-y divide-gridiron-700">
        {members.map((m) => (
          <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">{m.user.name} <span className="text-gray-500 text-xs">{m.user.email}</span></p>
              <p className="text-xs text-gray-500">{m.picks.length} pick{m.picks.length === 1 ? '' : 's'} made</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm text-gray-300">
                <input type="checkbox" checked={m.paid} onChange={(e) => update(m.id, { paid: e.target.checked })} />
                Paid
              </label>
              <label className="flex items-center gap-1 text-sm text-gray-300">
                <input type="checkbox" checked={m.eliminated} onChange={(e) => update(m.id, { eliminated: e.target.checked })} />
                Eliminated
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
