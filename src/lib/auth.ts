import { PrismaAdapter } from '@auth/prisma-adapter'
import type { AuthOptions } from 'next-auth'
import type { OAuthConfig } from 'next-auth/providers/oauth'
import GoogleProvider from 'next-auth/providers/google'
import FacebookProvider from 'next-auth/providers/facebook'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { sendMail, emailTemplates } from './email'

// NextAuth v4 dropped its built-in Yahoo provider after Yahoo moved to
// standard OpenID Connect, so it's configured here directly against Yahoo's
// documented OIDC endpoints (https://developer.yahoo.com/oauth2/guide/).
interface YahooProfile {
  sub: string
  name?: string
  email?: string
  picture?: string
}

function YahooProvider(options: { clientId: string; clientSecret: string }): OAuthConfig<YahooProfile> {
  return {
    id: 'yahoo',
    name: 'Yahoo',
    type: 'oauth',
    wellKnown: 'https://api.login.yahoo.com/.well-known/openid-configuration',
    authorization: { params: { scope: 'openid email profile' } },
    idToken: true,
    checks: ['pkce', 'state'],
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    profile(profile: YahooProfile) {
      return { id: profile.sub, name: profile.name, email: profile.email, image: profile.picture }
    },
  }
}

const providers: AuthOptions['providers'] = []

if (process.env.GOOGLE_CLIENT_ID) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  )
}

if (process.env.FACEBOOK_CLIENT_ID) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    })
  )
}

if (process.env.YAHOO_CLIENT_ID) {
  providers.push(
    YahooProvider({
      clientId: process.env.YAHOO_CLIENT_ID!,
      clientSecret: process.env.YAHOO_CLIENT_SECRET!,
    })
  )
}

if (process.env.MICROSOFT_CLIENT_ID) {
  providers.push(
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
    })
  )
}

// Email/password fallback for anyone who doesn't want to use a social login.
providers.push(
  CredentialsProvider({
    name: 'Email and password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      const user = await prisma.user.findUnique({ where: { email: credentials.email } })
      if (!user?.passwordHash) return null
      const valid = await bcrypt.compare(credentials.password, user.passwordHash)
      if (!valid) return null
      return { id: user.id, name: user.name, email: user.email, image: user.image }
    },
  })
)

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' }, // required when mixing OAuth providers with Credentials
  providers,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.userId
      return session
    },
  },
  events: {
    async createUser({ user }) {
      if (user.email) {
        await sendMail(
          user.email,
          `Welcome${process.env.APP_NAME ? ' to ' + process.env.APP_NAME : ''}!`,
          emailTemplates.welcome(user.name ?? 'there', process.env.APP_NAME || 'Survivor Pool')
        )
      }
    },
  },
}
