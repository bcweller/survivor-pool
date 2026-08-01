import nodemailer from 'nodemailer'

let cachedTransport: nodemailer.Transporter | null = null

function getTransport() {
  if (cachedTransport) return cachedTransport
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not set — emails will be logged to console instead of sent.')
    return null
  }
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  })
  return cachedTransport
}

export async function sendMail(to: string, subject: string, html: string) {
  const transport = getTransport()
  const from = process.env.SMTP_FROM || 'Survivor Pool <no-reply@localhost>'
  if (!transport) {
    console.log(`[email:dev] To: ${to} | Subject: ${subject}\n${html}`)
    return
  }
  await transport.sendMail({ from, to, subject, html })
}

const wrap = (title: string, body: string) => `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color:#111827;">
    <h2 style="color:#111827; margin-bottom: 4px;">${title}</h2>
    <div style="font-size: 15px; line-height: 1.6; color:#374151;">${body}</div>
    <hr style="margin-top:24px;border:none;border-top:1px solid #e5e7eb;" />
    <p style="font-size:12px;color:#9ca3af;">${process.env.APP_NAME || 'Survivor Pool'}</p>
  </div>
`

export const emailTemplates = {
  welcome: (name: string, leagueName: string) =>
    wrap(
      `Welcome to ${leagueName}, ${name}!`,
      `Your account has been created. Pick one NFL team each week that you think will win or tie straight-up.
       Win or tie and you advance. Lose and you're out. Each team can only be used once all season, so choose wisely.
       Good luck!`
    ),
  pickConfirmation: (name: string, week: number, teamName: string) =>
    wrap(
      `Pick locked in for Week ${week}`,
      `Hi ${name}, your pick of the <strong>${teamName}</strong> for Week ${week} has been recorded. You can change it any time before kickoff.`
    ),
  autoPickAssigned: (name: string, week: number, teamName: string) =>
    wrap(
      `We picked for you — Week ${week}`,
      `Hi ${name}, you didn't submit a pick before kickoff, so we automatically assigned you the <strong>${teamName}</strong> (this week's biggest favorite among your remaining eligible teams) to keep you alive. Don't forget next week!`
    ),
  weekResult: (name: string, week: number, teamName: string, survived: boolean) =>
    survived
      ? wrap(
          `You survived Week ${week}!`,
          `Your pick, the <strong>${teamName}</strong>, won (or tied). You're still alive — make your next pick soon.`
        )
      : wrap(
          `Eliminated in Week ${week}`,
          `Your pick, the <strong>${teamName}</strong>, lost. Unfortunately you've been eliminated from the pool. Thanks for playing!`
        ),
  reminder: (name: string, week: number, deadline: string) =>
    wrap(
      `Reminder: pick your Week ${week} team`,
      `Hi ${name}, you haven't made a pick for Week ${week} yet. Picks lock at ${deadline}. If you miss it, we'll auto-pick your biggest remaining favorite for you.`
    ),
}
