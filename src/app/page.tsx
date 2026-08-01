import Link from 'next/link'

const TEAM_LOGOS = ['kc', 'phi', 'sf', 'buf', 'dal', 'gb', 'bal', 'det']

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="text-center space-y-6 py-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Last one standing wins.
        </h1>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          Pick one NFL team to win straight-up, every week. Win or tie, you survive. Lose, you&rsquo;re out.
          Each team can only be used once all season. Free to run, no rake, no house cut &mdash; just your league.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/login" className="btn-primary">Join the pool</Link>
          <Link href="/standings" className="btn-secondary">View standings</Link>
        </div>
        <div className="flex justify-center gap-3 flex-wrap pt-4 opacity-80">
          {TEAM_LOGOS.map((abbr) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={abbr} src={`https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`} alt={abbr} className="h-12 w-12" />
          ))}
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="font-bold text-white mb-2">1. Pick a winner</h3>
          <p className="text-sm text-gray-400">Every week, choose one NFL team you think wins straight-up &mdash; no point spread involved.</p>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-white mb-2">2. Survive or bust</h3>
          <p className="text-sm text-gray-400">Win or tie, you advance. Lose, and you&rsquo;re eliminated for the rest of the season.</p>
        </div>
        <div className="card p-6">
          <h3 className="font-bold text-white mb-2">3. Never repeat a team</h3>
          <p className="text-sm text-gray-400">Once you pick a team, it&rsquo;s used up for the season &mdash; choose your favorites wisely.</p>
        </div>
      </section>

      <section className="card p-6">
        <h3 className="font-bold text-white mb-2">Missed a week?</h3>
        <p className="text-sm text-gray-400">
          If you forget to pick before kickoff, we automatically assign you that week&rsquo;s biggest point-spread
          favorite among your remaining eligible teams, so a missed reminder doesn&rsquo;t end your season early.
        </p>
      </section>
    </div>
  )
}
