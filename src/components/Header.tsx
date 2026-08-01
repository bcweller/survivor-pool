'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { BASE_PATH } from '@/lib/basePath'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="border-b border-gridiron-700 bg-gridiron-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-white">
          🏈 {process.env.NEXT_PUBLIC_APP_NAME || 'Survivor Pool'}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {session ? (
            <>
              <Link href="/dashboard" className="text-gray-300 hover:text-white">Dashboard</Link>
              <Link href="/standings" className="text-gray-300 hover:text-white">Standings</Link>
              <Link href="/admin" className="text-gray-300 hover:text-white">Commissioner</Link>
              {/* Explicit relative callbackUrl: signOut() defaults to window.location.href,
                  an absolute URL whose host may not match NEXTAUTH_URL's configured origin
                  (e.g. reached via a LAN hostname instead of the IP in .env) — NextAuth then
                  silently discards that "external" callback and redirects to the bare
                  configured origin with no /survivor-pool prefix, landing on a different app
                  entirely. A relative, basePath-prefixed URL avoids that origin check. */}
              <button onClick={() => signOut({ callbackUrl: `${BASE_PATH}/login` })} className="btn-secondary text-xs">Sign out</button>
            </>
          ) : (
            <Link href="/login" className="btn-primary text-xs">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  )
}
