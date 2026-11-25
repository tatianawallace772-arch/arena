import { useState } from 'react';
import { Bell, Database, Download, Lock, Moon, Palette, RotateCcw, Shield, Sun, Trash2, Upload, User } from 'lucide-react';
import { useStore } from '../lib/store';
import { useUI } from '../components/ui';
import { navigate } from '../lib/router';

export function SettingsPage() {
  const { state, me, setTheme, reset, setState } = useStore();
  const ui = useUI();
  const [notifPrefs, setNotifPrefs] = useState({ comments: true, reactions: true, birthdays: true, groups: false, messages: true });
  const [privateProfile, setPrivateProfile] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'junction-export.json';
    a.click();
    URL.revokeObjectURL(url);
    ui.toast('Your Junction data was exported');
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.users || !parsed.posts) throw new Error('Not a Junction export');
        setState(() => ({ ...parsed, version: 1 }));
        ui.toast('Feed restored from export');
      } catch {
        ui.toast('That file isn’t a valid Junction export');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="page-wrap narrow">
      <div className="page-head">
        <div>
          <h1>Settings & privacy</h1>
          <p>Everything here is local to your browser — nothing leaves this demo.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="widget-head"><span><User size={16} /> Account</span></div>
        <div style={{ padding: '4px 16px 16px' }}>
          <div className="row" style={{ gap: 12, padding: '8px 0' }}>
            <img className="avatar" src={me.avatar} width={52} height={52} alt="" />
            <div className="grow">
              <div style={{ fontWeight: 700 }}>{me.name}</div>
              <div className="hint">@{me.handle} · {me.location}</div>
            </div>
            <button className="btn btn-sm btn-soft" onClick={() => navigate(`/profile/${me.id}`)}>View profile</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="widget-head"><span><Palette size={16} /> Appearance</span></div>
        <div style={{ padding: '4px 16px 16px' }}>
          <div className="seg" style={{ maxWidth: 320 }}>
            <button className={state.theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={15} /> Light</button>
            <button className={state.theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={15} /> Dark</button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Dark mode is remembered per browser.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="widget-head"><span><Bell size={16} /> Notifications</span></div>
        <div style={{ padding: '4px 16px 16px' }}>
          {(
            [
              ['comments', 'Comments on your posts'],
              ['reactions', 'Reactions to your posts'],
              ['birthdays', 'Friends’ birthdays'],
              ['groups', 'Group activity'],
              ['messages', 'New messages'],
            ] as Array<[keyof typeof notifPrefs, string]>
          ).map(([k, label]) => (
            <label key={k} className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
              <span style={{ fontSize: 14.5 }}>{label}</span>
              <input
                type="checkbox"
                checked={notifPrefs[k]}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, [k]: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: 'var(--brand)' }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="widget-head"><span><Lock size={16} /> Privacy</span></div>
        <div style={{ padding: '4px 16px 16px' }}>
          <label className="row" style={{ justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer' }}>
            <span>
              <span style={{ display: 'block', fontSize: 14.5 }}>Private profile</span>
              <span className="hint">Only friends can see your posts</span>
            </span>
            <input type="checkbox" checked={privateProfile} onChange={(e) => { setPrivateProfile(e.target.checked); ui.toast('Privacy preference saved'); }} style={{ width: 18, height: 18, accentColor: 'var(--brand)' }} />
          </label>
          <div className="row" style={{ justifyContent: 'space-between', padding: '10px 0' }}>
            <span>
              <span style={{ display: 'block', fontSize: 14.5 }}>Blocked accounts</span>
              <span className="hint">No one is blocked</span>
            </span>
            <button className="btn btn-sm btn-soft" onClick={() => ui.toast('Blocking is stubbed in this demo')}>Manage</button>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', padding: '10px 0' }}>
            <span>
              <span style={{ display: 'block', fontSize: 14.5 }}>Data & permissions</span>
              <span className="hint">Everything stays on this device</span>
            </span>
            <Shield size={18} className="muted" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="widget-head"><span><Database size={16} /> Your data</span></div>
        <div style={{ padding: '4px 16px 16px' }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', padding: '6px 0' }}>
            <button className="btn btn-soft" onClick={exportData}><Download size={16} /> Export your data</button>
            <label className="btn btn-soft" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> Import a backup
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importData(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <button className="btn btn-soft" onClick={() => navigate('/import')}><Upload size={16} /> Import from Facebook</button>
          </div>
          <hr className="divider" />
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span>
              <span style={{ display: 'block', fontWeight: 650 }}>Start over</span>
              <span className="hint">Reset every post, friend, and preference to the original demo seed.</span>
            </span>
            <button
              className="btn"
              style={{ background: 'var(--red)', color: '#fff' }}
              onClick={() => {
                if (window.confirm('Reset Junction to its demo seed? Your posts and messages will be lost.')) {
                  reset();
                  ui.toast('Fresh demo data restored');
                }
              }}
            >
              <RotateCcw size={16} /> Reset demo
            </button>
          </div>
        </div>
      </div>

      <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Trash2 size={14} /> Clearing your browser storage removes all Junction state, including your profile edits.
      </p>
    </div>
  );
}
