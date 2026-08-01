'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const PROVIDERS = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'azure-ad', label: 'Continue with Microsoft' },
  { id: 'yahoo', label: 'Continue with Yahoo' },
  { id: 'facebook', label: 'Continue with Facebook' },
]

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error?.formErrors?.[0] || data?.error || 'Could not create account')
        }
      }
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) throw new Error('Invalid email or password')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white text-center">
        {mode === 'signin' ? 'Sign in' : 'Create your account'}
      </h1>

      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <button key={p.id} onClick={() => signIn(p.id, { callbackUrl: '/dashboard' })} className="btn-secondary w-full">
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px bg-gridiron-700 flex-1" /> or {mode === 'signin' ? 'sign in' : 'sign up'} with email <div className="h-px bg-gridiron-700 flex-1" />
      </div>

      <form onSubmit={handleCredentials} className="space-y-3">
        {mode === 'signup' && (
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400">
        {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button className="text-accent underline" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
