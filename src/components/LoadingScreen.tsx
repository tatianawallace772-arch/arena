import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Shield } from './Icons';

export default function LoadingScreen({
  progress,
  error,
  onRetry,
  done,
}: {
  progress: number;
  error?: string | null;
  onRetry?: () => void;
  done: boolean;
}) {
  return (
    <div className={`loading-screen${done ? ' done' : ''}`} aria-hidden={done}>
      <Shield highway="I-95" size={92} className="loading-shield" />
      <div className="loading-title">Interstate</div>
      {!error ? (
        <>
          <div className="loading-sub">
            Loading the U.S. interstate network
            <br />
            38,553 exits · 132,281 places · 1,338 rest areas
          </div>
          <div className="loading-track">
            <div className="loading-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="loading-pct">
            {progress >= 0.995 ? 'Building the map…' : `${Math.round(progress * 100)}%`}
          </div>
        </>
      ) : (
        <div className="loading-error">
          <AlertTriangle size={28} style={{ color: '#f9ab00' }} />
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="btn" onClick={onRetry}>
              <RefreshCw size={16} /> Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
