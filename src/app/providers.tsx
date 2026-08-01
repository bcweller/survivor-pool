'use client'

import { SessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'
import { BASE_PATH } from '@/lib/basePath'

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider basePath={`${BASE_PATH}/api/auth`}>{children}</SessionProvider>
}
