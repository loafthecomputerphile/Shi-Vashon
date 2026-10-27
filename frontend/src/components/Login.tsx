import { useState } from 'react'
import { Info as InfoIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authFetch, type Session } from '@/lib/auth'
import { Heading } from '@/components/kit/tiles'
import { FieldLabel, PasswordField } from '@/components/kit/fields'

// Login.tsx — shown instead of the whole app when nobody is logged in.
// Two modes in one screen: log in, or request access (which emails the
// owner — see the worker's /api/request).

export default function Login({ onLoggedIn, onInfo }: { onLoggedIn: (s: Session) => void; onInfo: () => void }) {
  const [mode, setMode] = useState<'login' | 'request'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'login') {
        const data = (await authFetch('/api/login', { email, password })) as { email: string; admin: boolean }
        onLoggedIn({ email: data.email, admin: data.admin })
      } else {
        await authFetch('/api/request', { email, note })
        setMessage('Request sent! The owner will set up your login and get back to you.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <Heading level={1} className="mb-1">Shiah's Closet</Heading>
      <p className="mb-8 text-sm text-muted-foreground">
        {mode === 'login' ? 'Log in to your account.' : 'Ask the owner for an account.'}
      </p>

      {/* Mode switch */}
      <div className="mb-6 flex gap-4 text-sm">
        <button
          type="button"
          onClick={() => { setMode('login'); setError(null); setMessage(null) }}
          className={mode === 'login' ? 'font-medium underline underline-offset-4' : 'text-muted-foreground'}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => { setMode('request'); setError(null); setMessage(null) }}
          className={mode === 'request' ? 'font-medium underline underline-offset-4' : 'text-muted-foreground'}
        >
          Request access
        </button>
        <button
          type="button"
          onClick={onInfo}
          className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <InfoIcon className="size-4" /> How it works
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <FieldLabel>Email</FieldLabel>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>

        {mode === 'login' ? (
          <div>
            <FieldLabel>Password</FieldLabel>
            <PasswordField value={password} onChange={setPassword} placeholder="••••••••" />
          </div>
        ) : (
          <div>
            <FieldLabel>Note for the owner (optional)</FieldLabel>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hi, I'm…" />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-primary">{message}</p>}

        <Button type="submit" disabled={busy}>
          {busy ? 'Sending…' : mode === 'login' ? 'Log in' : 'Send request'}
        </Button>
      </form>
    </section>
  )
}