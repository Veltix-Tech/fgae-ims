import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { SignIn } from '../features/auth/SignIn'
import { LocaleProvider } from '../i18n/locale'
import { App } from '../app/App'
import { AuthError, type AuthService, type Identity } from '../services/contracts/auth'

it('focuses invalid fields and preserves passwords on service failure', async () => {
  const service: AuthService = { restore: vi.fn().mockResolvedValue(null), signIn: vi.fn().mockRejectedValue(new AuthError('NETWORK')), signOut: vi.fn() }
  render(<LocaleProvider><SignIn service={service} /></LocaleProvider>)
  const user = userEvent.setup()
  const submit = await screen.findByRole('button', { name: 'Sign in' })
  await user.click(submit)
  expect(screen.getByLabelText('Email address')).toHaveFocus()
  await user.type(screen.getByLabelText('Email address'), 'someone@example.test')
  await user.click(submit)
  expect(screen.getByLabelText('Password', { exact: true })).toHaveFocus()
  await user.type(screen.getByLabelText('Password', { exact: true }), 'my input')
  await user.click(submit)
  expect(await screen.findByRole('alert')).toHaveTextContent('Check your internet connection')
  expect(screen.getByRole('alert')).toHaveFocus()
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('my input')
})

it('disables duplicate submissions, then clears password on success', async () => {
  let finish!: (identity: Identity) => void
  const signIn = vi.fn(() => new Promise<Identity>(resolve => { finish = resolve }))
  const service: AuthService = { restore: async () => null, signIn, signOut: async () => {} }
  render(<LocaleProvider><SignIn service={service} /></LocaleProvider>)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email address'), 'volunteer@example.test')
  await user.type(screen.getByLabelText('Password', { exact: true }), 'Demo-only-2026!')
  await user.dblClick(screen.getByRole('button', { name: 'Sign in' }))
  expect(signIn).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
  finish({ id: '1', name: 'Fictional', email: 'volunteer@example.test', accountState: 'ACTIVE', grants: [], mustChangePassword: false })
  await waitFor(() => expect(screen.getByRole('heading', { name: 'You’re signed in' })).toHaveFocus())
  await user.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByLabelText('Password', { exact: true })).toHaveValue('')
})

it('switches to Amharic without losing input and persists locale', async () => {
  render(<LocaleProvider><App /></LocaleProvider>)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Email address'), 'draft@example.test')
  await user.type(screen.getByLabelText('Password', { exact: true }), 'retain-this')
  await user.click(screen.getByRole('button', { name: 'Show password' }))
  await user.click(screen.getByRole('button', { name: 'Language: English' }))
  await user.click(screen.getByRole('button', { name: 'አማርኛ' }))
  expect(document.documentElement.lang).toBe('am')
  expect(localStorage.getItem('fgae.locale')).toBe('am')
  expect(screen.getByLabelText('የኢሜይል አድራሻ')).toHaveValue('draft@example.test')
  expect(screen.getByLabelText('የይለፍ ቃል', { exact: true })).toHaveValue('retain-this')
  expect(screen.getByRole('button', { name: 'የይለፍ ቃሉን ደብቅ' })).toHaveAttribute('aria-pressed', 'true')
})
