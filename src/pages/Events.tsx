import type { CSSProperties } from 'react';
import { CalendarDays, Clock3, MapPin, Users } from 'lucide-react';

export interface EventItem {
  id: string;
  title: string;
  month: string;
  day: string;
  when: string;
  where: string;
  going: number;
  interested: number;
  host: string;
  hostId: string;
  cover: string;
  desc: string;
  upcoming?: boolean;
  price?: string;
}

const d = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return {
    month: date.toLocaleDateString([], { month: 'short' }),
    day: String(date.getDate()),
    weekday: date.toLocaleDateString([], { weekday: 'long' }),
    date: date.toLocaleDateString([], { month: 'long', day: 'numeric' }),
  };
};

export const EVENT_LIST: EventItem[] = [
  {
    id: 'e1',
    title: 'Sunrise Ridge Hike with Trailbound',
    ...d(2),
    when: `${d(2).weekday}, ${d(2).date} · 5:45 AM`,
    where: 'Lower trailhead lot, San Juan Mountains',
    going: 6,
    interested: 34,
    host: 'Trailbound',
    hostId: 'trailbound',
    cover: '/assets/photos/hike.jpg',
    desc: 'Six miles up and back before the light gets flat. Coffee and a thermos at the top, all levels welcome, no dog this time (sorry).',
    upcoming: true,
    price: '$18',
  },
  {
    id: 'e2',
    title: 'Sunday Suppers at Juniper Kitchen',
    ...d(9),
    when: `${d(9).weekday}, ${d(9).date} · 6:00 PM`,
    where: 'Juniper Kitchen, East Austin',
    going: 28,
    interested: 112,
    host: 'Juniper Kitchen',
    hostId: 'juniper',
    cover: '/assets/photos/tacos.jpg',
    desc: 'One menu, one seating, whoever shows up. This month: charred elote, short rib, and whatever Dolly the starter produced this week.',
    price: '$45 tasting menu',
  },
  {
    id: 'e3',
    title: 'Portfolio Night — The Design Crit',
    ...d(12),
    when: `${d(12).weekday}, ${d(12).date} · 7:00 PM`,
    where: 'Northbeam Studio · Seattle + Zoom',
    going: 41,
    interested: 220,
    host: 'Priya Raman',
    hostId: 'priya',
    cover: '/assets/photos/desk.jpg',
    desc: 'Bring three screens of work and one honest question. Reviewers from Northbeam, Cartlane and independent studios. Notes are kind, specific, and free.',
    price: 'Free',
  },
  {
    id: 'e4',
    title: 'Slow Coffee Sunday',
    ...d(16),
    when: `${d(16).weekday}, ${d(16).date} · 9:00 AM`,
    where: 'Little Fern Coffee · Austin',
    going: 19,
    interested: 64,
    host: 'Hannah Mercer',
    hostId: 'hannah',
    cover: '/assets/photos/cafe.jpg',
    desc: 'No laptops, no rush. We brew three coffees, talk about one of them, and let the morning be slow. Mugs provided.',
    price: 'Free · coffee sold separately',
  },
  {
    id: 'e5',
    title: 'Community Garden Harvest Day',
    ...d(23),
    when: `${d(23).weekday}, ${d(23).date} · 8:00 AM`,
    where: 'Durham Community Garden',
    going: 33,
    interested: 88,
    host: 'Grace Okafor',
    hostId: 'grace',
    cover: '/assets/photos/garden.jpg',
    desc: 'Bring gloves and a bag. We harvest what’s ready and split it. First-timers get the okra.',
    price: 'Free',
  },
];

export function EventsPage() {
  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p>Things happening around your people in the next few weeks.</p>
        </div>
      </div>
      <div className="grid-3">
        {EVENT_LIST.map((e) => (
          <article key={e.id} className="card event-card">
            <div className="tile-cover" style={{ borderRadius: 0 }}>
              <img src={e.cover} alt="" loading="lazy" />
              <span className="event-cal tc-badge" style={{ background: 'var(--surface)' }}>
                <div className="m">{e.month}</div>
                <div className="d">{e.day}</div>
              </span>
            </div>
            <div style={{ padding: '12px 14px 6px' }}>
              <div style={{ fontWeight: 750, fontSize: 16, lineHeight: 1.3, letterSpacing: '-.015em' }}>{e.title}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{e.when}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{e.where}</div>
            </div>
            <div style={{ padding: '4px 14px 14px', marginTop: 'auto' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="hint">{e.going} going · {e.interested} interested</span>
                <button className="btn btn-sm btn-brand">Going</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function EventDetailPage({ id }: { id: string }) {
  const event = EVENT_LIST.find((e) => e.id === id) ?? EVENT_LIST[0];
  return (
    <div className="page-wrap mid">
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ position: 'relative' }}>
          <img src={event.cover} alt="" style={{ width: '100%', height: 280, objectFit: 'cover' }} />
          <div className="cover-tint" />
          <span className="tag" style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,.55)', color: '#fff', fontWeight: 700 }}>
            <span className="alert-dot" /> <span>Event</span>
          </span>
        </div>
        <div style={{ padding: '18px 22px 22px' }}>
          <div className="row" style={{ gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="event-cal" style={{ width: 68 }}>
              <div className="m" style={{ fontSize: 12 }}>{event.month}</div>
              <div className="d" style={{ fontSize: 26 }}>{event.day}</div>
            </div>
            <div className="grow">
              <h1 style={{ fontSize: 28, letterSpacing: '-.035em', lineHeight: 1.15 }}>{event.title}</h1>
              <div className="profile-meta">
                <span><Clock3 size={14} /> {event.when}</span>
                <span><MapPin size={14} /> {event.where}</span>
              </div>
            </div>
            <button className="btn btn-brand btn-lg">Going</button>
          </div>
          <hr className="divider" style={{ margin: '18px 0' }} />
          <div className="row" style={{ alignItems: 'flex-start', gap: 26, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 320px' }}>
              <h3 style={{ fontSize: 17, marginBottom: 8 }}>Details</h3>
              <p style={{ color: 'var(--text-2)', fontSize: 14.5, lineHeight: 1.6 }}>{event.desc}</p>
              {event.price && (
                <p style={{ marginTop: 14, fontWeight: 650 }}>
                  🎟️ {event.price}
                </p>
              )}
              <p style={{ marginTop: 14 }} className="muted">
                Hosted by <span className="link">{event.host}</span>
              </p>
            </div>
            <div className="widget" style={{ flex: '1 1 240px' as CSSProperties['flex'] }}>
              <div className="widget-head"><span>Who’s going</span></div>
              <div className="widget-body">
                <div className="row" style={{ justifyContent: 'space-between', padding: '6px 8px' }}>
                  <span className="row" style={{ gap: 7 }}>
                    <CalendarDays size={16} className="muted" /> {event.going} going
                  </span>
                  <span className="row" style={{ gap: 7 }}>
                    <Users size={16} className="muted" /> {event.interested} interested
                  </span>
                </div>
                <div className="row" style={{ padding: '8px', gap: 0 }}>
                  {['priya', 'daniel', 'hannah', 'omar'].map((u, i) => (
                    <img
                      key={u}
                      src={`/assets/avatars/${u}.jpg`}
                      alt=""
                      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--surface)', marginLeft: i ? -8 : 0 }}
                    />
                  ))}
                  <span className="hint" style={{ marginLeft: 8 }}>and {Math.max(0, event.going - 4)} others</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
