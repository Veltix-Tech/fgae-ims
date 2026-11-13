import { readdir, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const files = await readdir('dist/assets')
const scripts = files.filter(file => file.endsWith('.js'))
assert(scripts.length, 'Build the live bundle first')
const text = (await Promise.all(scripts.map(file => readFile(`dist/assets/${file}`, 'utf8')))).join('\n')
for (const marker of ['Demo-only-2026!', 'example.test', 'fgae.synthetic.auth', 'fgae.synthetic.recovery', 'fgae.synthetic.credentials', 'fgae.synthetic.registration', 'synthetic-registration-', 'synthetic-application-', 'fgae.synthetic.corrections', 'synthetic-returned-application', 'demo-reset-', 'synthetic-reset-', 'fictional-person', 'fictional-area']) {
  assert(!text.includes(marker), `Synthetic marker leaked into live build: ${marker}`)
}
for (const endpoint of ['/auth/login', '/auth/refresh', '/auth/me', '/auth/forgot-password', '/auth/reset-password/validate', '/auth/reset-password', '/auth/first-login/password', '/volunteers/applications', '/volunteers/applications/me', '/volunteers/applications/me/corrections', '/resubmit', '/volunteers/registration/config', '/volunteers/registration/draft', '/volunteers/registration/documents']) assert(text.includes(endpoint), `Missing live endpoint ${endpoint}`)
console.log('PASS: live bundle contains auth endpoints and excludes synthetic accounts, credentials and storage.')
