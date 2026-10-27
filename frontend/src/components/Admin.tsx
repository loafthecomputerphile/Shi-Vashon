import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authFetch, type Session } from '@/lib/auth'
import { Heading } from '@/components/kit/tiles'
import { ConfirmButton } from '@/components/kit/buttons'
import { FieldLabel, PasswordField } from '@/components/kit/fields'

// Admin.tsx — owner-only tab. Sees pending access requests (creates their
// logins) and existing users (deletes). Only reachable when the session is
// admin; the worker double-checks on every call anyway.

type Request = { email: string; note?: string; ts: number }
type User = { email: string; admin?: boolean; limit?: number }

export default function Admin({ session }: { session: Session }) {
  const [requests, setRequests] = useState<Request[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)
  // Per-request form state: password + optional daily-limit override.
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [limits, setLimits] = useState<Record<string, string>>({})

  async function refresh() {
    try {
      const reqs = (await authFetch('/api/admin/requests')) as { requests: Request[] }
      const usrs = (await authFetch('/api/admin/users')) as { users: User[] }
      setRequests(reqs.requests)
      setUsers(usrs.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.')
    }
  }
  useEffect(() => { refresh() }, [])

  async function createAccount(email: string) {
    setError(null)
    try {
      await authFetch('/api/admin/users', {
        email,
        password: passwords[email] || '',
        limit: limits[email] ? Number(limits[email]) : undefined,
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account.')
    }
  }

  async function deleteUser(email: string) {
    await authFetch(`/api/admin/users/${encodeURIComponent(email)}`, {}, 'DELETE')
    await refresh()
  }

  const section = 'mb-10'
  const pending = requests.filter((r) => !users.some((u) => u.email === r.email))

  return (
    <section className="mx-auto max-w-xl">
      <Heading level={1} className="mb-2">Admin</Heading>
      <p className="mb-8 text-sm text-muted-foreground">Logged in as {session.email}</p>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className={section}>
        <Heading level={3} className="mb-3">Access requests</Heading>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {pending.map((r) => (
              <div key={r.email} className="border border-border p-3">
                <p className="text-sm font-medium">{r.email}</p>
                {r.note && <p className="mb-2 text-xs text-muted-foreground">“{r.note}”</p>}
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-44 flex-1">
                    <FieldLabel>New password</FieldLabel>
                    <PasswordField
                      value={passwords[r.email] ?? ''}
                      onChange={(v) => setPasswords((p) => ({ ...p, [r.email]: v }))}
                      placeholder="min 6 characters"
                    />
                  </div>
                  <div className="w-24">
                    <FieldLabel>Daily limit</FieldLabel>
                    <Input
                      inputMode="numeric"
                      value={limits[r.email] ?? ''}
                      onChange={(e) => setLimits((l) => ({ ...l, [r.email]: e.target.value }))}
                      placeholder="4"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={!(passwords[r.email]?.length >= 6)}
                    onClick={() => createAccount(r.email)}
                  >
                    Create account
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={section}>
        <Heading level={3} className="mb-3">Users</Heading>
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div key={u.email} className="flex items-center justify-between border border-border p-3">
              <span className="text-sm">
                {u.email}
                {u.admin && <span className="ml-2 text-xs uppercase tracking-wider text-muted-foreground">admin</span>}
                {u.limit != null && <span className="ml-2 text-xs text-muted-foreground">limit {u.limit}/day</span>}
              </span>
              {u.email !== session.email && (
                <ConfirmButton
                  message={`Delete ${u.email}?`}
                  confirmLabel="Delete"
                  onConfirm={() => deleteUser(u.email)}
                  buttonProps={{ variant: 'outline', size: 'sm' }}
                >
                  Delete
                </ConfirmButton>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}