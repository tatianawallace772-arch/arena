'use strict';

/*
 * Connectivity diagnostics for the Inception Labs API.
 *
 * "fetch failed" tells you nothing. This walks the same connection one stage at
 * a time — DNS, TCP, TLS, HTTP, auth, model — and reports the first stage that
 * breaks, plus what to do about it.
 */

const dns = require('dns');
const net = require('net');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const STAGE = {
  DNS: 'dns',
  TCP: 'tcp',
  TLS: 'tls',
  HTTP: 'http',
  AUTH: 'auth',
  MODEL: 'model',
};

/** Map raw Node/system error codes onto an actionable explanation. */
function explain(code, host) {
  const hints = {
    ENOTFOUND: {
      headline: `DNS could not resolve ${host}`,
      action:
        'Check the hostname in INCEPTION_BASE_URL and that this machine has working DNS.',
    },
    EAI_AGAIN: {
      headline: 'DNS lookup timed out',
      action: 'The resolver is unreachable. Check your network or DNS settings.',
    },
    ECONNREFUSED: {
      headline: `Connection refused by ${host}`,
      action: 'Nothing is listening on that host/port, or a local proxy is refusing the connection.',
    },
    ETIMEDOUT: {
      headline: `TCP connection to ${host} timed out`,
      action:
        'Traffic is being dropped. This usually means a firewall, VPN, or a sandbox egress allowlist is blocking the host.',
    },
    ECONNRESET: {
      headline: `The connection to ${host} was reset during setup`,
      action:
        'The TCP connection opened but something reset it before/while the TLS handshake completed. ' +
        'That pattern is almost always an egress firewall or proxy allowlisting specific hosts — ' +
        'the packet is dropped rather than answered. Run this app somewhere with unrestricted ' +
        'outbound HTTPS, or allowlist api.inceptionlabs.ai.',
    },
    EPIPE: {
      headline: 'The connection was closed mid-request',
      action: 'Likely a proxy or firewall in the middle. Retry, then check egress rules.',
    },
    EHOSTUNREACH: {
      headline: `No route to ${host}`,
      action: 'No network route. Check connectivity, VPN, or split-tunnel settings.',
    },
    ENETUNREACH: { headline: 'Network unreachable', action: 'The machine has no route to the network.' },
    CERT_HAS_EXPIRED: {
      headline: 'The TLS certificate has expired',
      action: 'Check the system clock, or whether a proxy is intercepting TLS.',
    },
    DEPTH_ZERO_SELF_SIGNED_CERT: {
      headline: 'The TLS certificate is self-signed',
      action:
        'Something is intercepting TLS (corporate proxy). Install its CA, or set NODE_EXTRA_CA_CERTS.',
    },
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: {
      headline: 'The TLS certificate could not be verified',
      action:
        'A proxy is intercepting HTTPS. Install its root CA and point NODE_EXTRA_CA_CERTS at it.',
    },
    SELF_SIGNED_CERT_IN_CHAIN: {
      headline: 'A self-signed certificate is in the chain',
      action: 'Install the intercepting proxy root CA, or set NODE_EXTRA_CA_CERTS.',
    },
  };
  return hints[code] || null;
}

function checkDns(host) {
  return new Promise((resolve) => {
    dns.lookup(host, { all: true }, (err, addresses) => {
      if (err) return resolve({ ok: false, error: err.code, ...explain(err.code, host) });
      const v4 = addresses.filter((a) => a.family === 4);
      const v6 = addresses.filter((a) => a.family === 6);
      resolve({
        ok: true,
        addresses: addresses.map((a) => `${a.address} (IPv${a.family})`),
        ipv4: v4.length,
        ipv6: v6.length,
      });
    });
  });
}

/**
 * Open one connection, then speak HTTP over it, recording which phase failed.
 * `tlsFailures`: true when the failure happened before the TLS handshake ended.
 */
function probe(urlString, apiKey, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      return resolve({
        ok: false,
        stage: STAGE.DNS,
        error: 'INVALID_URL',
        headline: `INCEPTION_BASE_URL is not a valid URL: ${urlString}`,
        action: 'It should look like https://api.inceptionlabs.ai/v1',
      });
    }

    const host = parsed.hostname;
    const isHttps = parsed.protocol === 'https:';
    const port = Number(parsed.port) || (isHttps ? 443 : 80);
    const lib = isHttps ? https : http;

    let tcpOpened = false;
    let tlsDone = false;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        req.destroy();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        ok: false,
        stage: tlsDone ? STAGE.HTTP : tcpOpened ? STAGE.TLS : STAGE.TCP,
        error: 'ETIMEDOUT',
        headline: `No response from ${host} within ${timeoutMs / 1000}s`,
        action: explain('ETIMEDOUT', host).action,
      });
    }, timeoutMs);

    const headers = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: host,
        port,
        path: `${parsed.pathname.replace(/\/$/, '')}/models`,
        method: 'GET',
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          if (body.length < 4000) body += c;
        });
        res.on('end', () => {
          const status = res.statusCode;
          if (status === 401 || status === 403) {
            return finish({
              ok: false,
              stage: STAGE.AUTH,
              status,
              headline: 'Reached Inception Labs, but the API key was rejected',
              action:
                status === 401
                  ? 'INCEPTION_API_KEY is missing, wrong, or revoked. Generate a new key at platform.inceptionlabs.ai.'
                  : 'This key is not permitted to list models. Check the key’s scope.',
              body: body.slice(0, 300),
            });
          }
          if (status === 402) {
            return finish({
              ok: false,
              stage: STAGE.AUTH,
              status,
              headline: 'Reached Inception Labs, but billing is inactive',
              action: 'The account or key has no active billing/quota. Check your Inception dashboard.',
              body: body.slice(0, 300),
            });
          }
          if (status >= 200 && status < 300) {
            let models = [];
            try {
              const json = JSON.parse(body);
              const raw = json.data || json.models || [];
              models = raw
                .map((m) => (typeof m === 'string' ? m : m.id || m.name))
                .filter(Boolean);
            } catch {
              /* non-JSON 200 is still a success */
            }
            if (!models.length) {
              return finish({
                ok: false,
                stage: STAGE.MODEL,
                status,
                headline: 'Connected, but this key can see no models',
                action: 'Your account may not be provisioned yet. Check the Inception dashboard.',
              });
            }
            return finish({
              ok: true,
              stage: 'ok',
              status,
              headline: `Connected to Inception Labs — ${models.length} model(s) available`,
              models,
            });
          }
          finish({
            ok: false,
            stage: STAGE.HTTP,
            status,
            headline: `Inception Labs returned HTTP ${status}`,
            action:
              status === 404
                ? 'The base URL path looks wrong. It should end in /v1.'
                : 'Unexpected response from the API. Check the Inception status page.',
            body: body.slice(0, 300),
          });
        });
      }
    );

    req.on('socket', (socket) => {
      socket.once(isHttps ? 'secureConnect' : 'connect', () => {
        if (isHttps) {
          tlsDone = true;
        } else {
          tcpOpened = true;
        }
      });
      socket.on('connect', () => {
        tcpOpened = true;
      });
    });

    req.on('error', (err) => {
      const stage = tlsDone ? STAGE.HTTP : tcpOpened ? STAGE.TLS : STAGE.TCP;
      const info = explain(err.code, host) || {};
      const note =
        !tlsDone && tcpOpened
          ? ' The TCP connection succeeded, so DNS and routing are fine — something in the middle ' +
            'is terminating connections to this host.'
          : '';
      finish({
        ok: false,
        stage,
        error: err.code || err.message,
        headline: info.headline || `${err.code || 'Network error'} while contacting ${host}`,
        action: (info.action || 'Check your network connection and try again.') + note,
        tcpOpened,
        tlsHandshakeCompleted: tlsDone,
      });
    });

    req.end();
  });
}

/** Full staged diagnosis. */
async function diagnose({ baseUrl, apiKey, timeoutMs = 15000 } = {}) {
  const started = Date.now();
  let host = '';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    /* handled by probe */
  }

  const dnsResult = host ? await checkDns(host) : { ok: false, error: 'INVALID_URL' };
  if (!dnsResult.ok) {
    return {
      ok: false,
      stage: STAGE.DNS,
      durationMs: Date.now() - started,
      baseUrl,
      endpoint: baseUrl,
      checks: [{ stage: STAGE.DNS, ok: false, error: dnsResult.error }],
      headline: dnsResult.headline || `Could not resolve ${host}`,
      action:
        dnsResult.action ||
        'DNS failed. Check INCEPTION_BASE_URL and that this machine can resolve names.',
    };
  }

  const probeResult = await probe(baseUrl, apiKey, timeoutMs);
  const checks = [
    {
      stage: STAGE.DNS,
      ok: true,
      detail: `${dnsResult.addresses.length} address(es): ${dnsResult.addresses.slice(0, 4).join(', ')}`,
    },
    { stage: STAGE.TCP, ok: probeResult.ok || probeResult.stage !== STAGE.TCP },
    { stage: STAGE.TLS, ok: probeResult.ok || ![STAGE.TCP, STAGE.TLS].includes(probeResult.stage) },
    { stage: STAGE.HTTP, ok: probeResult.ok || ![STAGE.TCP, STAGE.TLS, STAGE.HTTP].includes(probeResult.stage) },
  ];
  if (probeResult.ok) {
    checks.push({ stage: STAGE.AUTH, ok: true, detail: 'API key accepted' });
    checks.push({ stage: STAGE.MODEL, ok: true, detail: `${probeResult.models.length} model(s)` });
  }

  return {
    ok: probeResult.ok,
    stage: probeResult.stage,
    durationMs: Date.now() - started,
    baseUrl,
    host,
    endpoint: `${baseUrl.replace(/\/$/, '')}/models`,
    dns: { ipv4: dnsResult.ipv4, ipv6: dnsResult.ipv6 },
    checks,
    headline: probeResult.headline,
    action: probeResult.action,
    error: probeResult.error || null,
    status: probeResult.status || null,
    models: probeResult.models || [],
    // A bare "fetch failed" is what the user sees; give them the real story.
    summary: probeResult.ok
      ? 'Inception Labs API is reachable.'
      : `${probeResult.headline} — ${probeResult.action}`,
  };
}

module.exports = { diagnose, explain, STAGE };
