// server/test/registration.test.ts
import { test } from 'node:test';
import assert from 'node:assert';
import { registerUser, authenticateUser } from '../src/auth/service.js';

console.log('=================================================================');
console.log('  NEXUS AI WALLET — USER REGISTRATION & AUTHENTICATION SUITE    ');
console.log('=================================================================');

test('--- SUITE: Account Creation & Database Persistence ---', async () => {
  const uniqueEmail = `operator-${Date.now()}@nexus.ai`;
  const password = 'StrongPassword123!';
  const name = 'New Operator Test';

  // 1. Register new user
  const newUser = await registerUser(uniqueEmail, password, name, 'operator');
  assert.strictEqual(newUser.email, uniqueEmail.toLowerCase());
  assert.strictEqual(newUser.name, name);
  assert.strictEqual(newUser.role, 'operator');
  assert(newUser.userId.startsWith('usr-'), 'User ID generated with usr- prefix');
  console.log(`  ✓ PASS: New account successfully registered: ${uniqueEmail} (${newUser.userId})`);

  // 2. Reject duplicate registration
  await assert.rejects(
    async () => {
      await registerUser(uniqueEmail, password, name);
    },
    /already exists/,
    'Duplicate email registration is rejected'
  );
  console.log('  ✓ PASS: Duplicate account creation rejected with conflict error');

  // 3. Authenticate with new account credentials
  const authenticated = await authenticateUser(uniqueEmail, password);
  assert(authenticated !== null, 'Authenticated user returned');
  assert.strictEqual(authenticated.email, uniqueEmail.toLowerCase());
  assert.strictEqual(authenticated.name, name);
  console.log('  ✓ PASS: New account authenticated successfully with scrypt password verification');

  // 4. Reject invalid password for registered account
  const invalidAuth = await authenticateUser(uniqueEmail, 'WrongPassword!');
  assert.strictEqual(invalidAuth, null, 'Invalid password rejected');
  console.log('  ✓ PASS: Invalid password for registered account rejected');
});
