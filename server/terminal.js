'use strict';

const pty = require('node-pty');
const os = require('os');
const config = require('./config');

const sessions = new Map();
let counter = 0;

function defaultShell() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe';
  return process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
}

function shellEnv() {
  return {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: process.env.LANG || 'en_US.UTF-8',
  };
}

/**
 * Create an interactive PTY session.
 * @param {{cwd?:string, cols?:number, rows?:number, name?:string, onData?:Function, onExit?:Function}} opts
 */
function createSession({ cwd = config.workspaceRoot, cols = 80, rows = 24, name, onData, onExit } = {}) {
  const id = `term-${++counter}`;
  const proc = pty.spawn(defaultShell(), ['-l'], {
    name: 'xterm-256color',
    cols: Math.max(2, cols),
    rows: Math.max(2, rows),
    cwd,
    env: shellEnv(),
  });

  const session = {
    id,
    name: name || `Terminal ${counter}`,
    pid: proc.pid,
    cwd,
    createdAt: Date.now(),
    proc,
    buffer: '',
    listeners: new Set(),
    exited: false,
    exitCode: null,
  };

  proc.onData((data) => {
    // Keep a bounded scrollback for reconnects / agent inspection.
    session.buffer = (session.buffer + data).slice(-200_000);
    if (onData) onData(data);
    for (const fn of session.listeners) fn(data);
  });

  proc.onExit(({ exitCode, signal }) => {
    session.exited = true;
    session.exitCode = exitCode;
    if (onExit) onExit({ exitCode, signal });
    for (const fn of session.listeners) fn(null, { exitCode, signal });
    // Keep the record briefly so late joins can read final output.
    setTimeout(() => sessions.delete(id), 60_000).unref?.();
  });

  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id);
}

function listSessions() {
  return [...sessions.values()].map((s) => ({
    id: s.id,
    name: s.name,
    pid: s.pid,
    cwd: s.cwd,
    startedAt: s.createdAt,
    exited: s.exited,
    exitCode: s.exitCode,
  }));
}

function write(id, data) {
  const s = sessions.get(id);
  if (!s || s.exited) return false;
  s.proc.write(data);
  return true;
}

function resize(id, cols, rows) {
  const s = sessions.get(id);
  if (!s || s.exited) return false;
  try {
    s.proc.resize(Math.max(2, cols), Math.max(2, rows));
    return true;
  } catch {
    return false;
  }
}

function kill(id) {
  const s = sessions.get(id);
  if (!s) return false;
  try {
    s.proc.kill();
  } catch {
    /* already gone */
  }
  sessions.delete(id);
  return true;
}

function killAll() {
  for (const id of [...sessions.keys()]) kill(id);
}

module.exports = {
  createSession,
  getSession,
  listSessions,
  write,
  resize,
  kill,
  killAll,
  defaultShell,
};
