import { ChevronLeft } from 'lucide-react';
import { navigate } from '../lib/router';

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <div className="row" style={{ gap: 6, padding: '2px 2px 12px', fontSize: 13.5, color: 'var(--muted)' }}>
      {items.map((it, i) => (
        <span key={it.label} className="row" style={{ gap: 6 }}>
          {i > 0 && <span style={{ color: 'var(--faint)' }}>/</span>}
          {it.href ? (
            <a className="link" href={it.href} style={{ color: 'var(--muted)', fontWeight: 600 }}>{it.label}</a>
          ) : (
            <span>{it.label}</span>
          )}
        </span>
      ))}
      <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => navigate('/')}>
        <ChevronLeft size={15} /> Back to feed
      </button>
    </div>
  );
}
