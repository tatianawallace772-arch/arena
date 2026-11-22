#!/usr/bin/env node
'use strict';

/*
 * npm run doctor — staged connectivity diagnosis for the Inception Labs API.
 * Prints where the connection breaks and what to do about it.
 */

const config = require('./config');
const { diagnose } = require('./diagnostics');

const ICON = { true: '\x1b[32m✓\x1b[0m', false: '\x1b[31m✗\x1b[0m', skip: '\x1b[90m·\x1b[0m' };
const LABEL = {
  dns: 'DNS resolution',
  tcp: 'TCP connection',
  tls: 'TLS handshake',
  http: 'HTTP response',
  auth: 'API key accepted',
  model: 'Models available',
};

(async () => {
  console.log('\n\x1b[1mInception Labs connectivity check\x1b[0m');
  console.log(`  base url   ${config.inception.baseUrl}`);
  console.log(`  model      ${config.inception.model}`);
  console.log(`  api key    ${config.inception.apiKey ? `set (…${config.inception.apiKey.slice(-4)})` : '\x1b[31mMISSING\x1b[0m'}`);
  console.log('');

  if (!config.inception.apiKey) {
    console.log(`${ICON.false} No API key. Add INCEPTION_API_KEY to .env and retry.\n`);
    process.exit(1);
  }

  const result = await diagnose({
    baseUrl: config.inception.baseUrl,
    apiKey: config.inception.apiKey,
    timeoutMs: 15000,
  });

  for (const check of result.checks) {
    const mark = check.ok ? ICON.true : ICON.false;
    const detail = check.detail ? `  \x1b[90m${check.detail}\x1b[0m` : '';
    console.log(`  ${mark} ${LABEL[check.stage] || check.stage}${detail}`);
  }

  console.log('');
  if (result.ok) {
    console.log(`\x1b[32m✓ ${result.headline}\x1b[0m`);
    if (result.models.length) {
      console.log(`  models: ${result.models.slice(0, 8).join(', ')}`);
    }
    console.log('');
    process.exit(0);
  }

  console.log(`\x1b[31m✗ ${result.headline}\x1b[0m`);
  console.log(`\n  \x1b[1mWhat to do:\x1b[0m ${result.action}`);
  if (result.error) console.log(`  \x1b[90merror code: ${result.error}\x1b[0m`);

  if (result.stage === 'tls' || result.stage === 'tcp') {
    console.log(
      '\n  \x1b[90mCompare against a host that is expected to work:\n' +
        `    curl -s -o /dev/null -w '%{http_code}\\n' ${config.inception.baseUrl.replace(/\/v1$/, '')}/\n` +
        "    curl -s -o /dev/null -w '%{http_code}\\n' https://registry.npmjs.org/\x1b[0m"
    );
  }
  console.log('');
  process.exit(1);
})();
