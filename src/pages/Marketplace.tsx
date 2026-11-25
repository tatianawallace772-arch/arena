import { useState } from 'react';
import { Bookmark, Check, MapPin, MessageCircle, Search, Share2, Tag } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar, useUI, Modal, ModalHead } from '../components/ui';
import { navigate } from '../lib/router';
import { nfmt } from '../lib/util';

const CATEGORIES = ['All', 'Home & Garden', 'Bicycles', 'Cameras & Photography', 'Sporting Goods', 'Furniture', 'Garden & Outdoors'];

export function MarketplacePage() {
  const { state, toggleListingSave } = useStore();
  const ui = useUI();
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [sellOpen, setSellOpen] = useState(false);

  const list = state.listings.filter(
    (l) => (cat === 'All' || l.category === cat) && (!q || l.title.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <h1>Marketplace</h1>
          <p>Buy and sell with people nearby — no shipping, no strangers from across the world.</p>
        </div>
        <button className="btn btn-brand" onClick={() => setSellOpen(true)}>+ Sell something</button>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="searchbox" style={{ width: 340 }}>
          <span className="search-icon"><Search size={16} /></span>
          <input placeholder="Search Marketplace" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="hint">{list.length} listings near you</span>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="market-grid">
        {list.map((l) => (
          <article key={l.id} className="card market-card" onClick={() => navigate(`/marketplace/${l.id}`)}>
            <div className="mc-img">
              <img src={l.image} alt="" loading="lazy" />
              <button
                className="mc-save"
                aria-label={l.saved ? 'Unsave listing' : 'Save listing'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleListingSave(l.id);
                  ui.toast(l.saved ? 'Removed from saved' : 'Saved listing');
                }}
              >
                <Bookmark size={16} fill={l.saved ? 'currentColor' : 'none'} color={l.saved ? 'var(--brand)' : undefined} />
              </button>
            </div>
            <div className="mc-body">
              <div className="mc-price">${l.price.toLocaleString()}</div>
              <div className="mc-title clamp-2">{l.title}</div>
              <div className="mc-place">{l.place}</div>
            </div>
          </article>
        ))}
      </div>

      {list.length === 0 && (
        <div className="card empty-state">
          <div className="es-icon"><Tag size={26} /></div>
          <h3>No listings yet</h3>
          <p>Try a different category or clear your search.</p>
        </div>
      )}

      {sellOpen && <SellModal onClose={() => setSellOpen(false)} />}
    </div>
  );
}

function SellModal({ onClose }: { onClose: () => void }) {
  const { createListingStub } = useMarketHelpers();
  const ui = useUI();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(CATEGORIES[1]);
  const [desc, setDesc] = useState('');

  return (
    <Modal onClose={onClose} label="Create listing">
      <ModalHead title="Create a listing" onClose={onClose} />
      <div className="modal-body">
        <div className="field">
          <label>Title</label>
          <input className="input" placeholder="e.g. Vintage film camera" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field grow">
            <label>Price (USD)</label>
            <input className="input" type="number" min={0} placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field grow">
            <label>Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Description</label>
          <textarea className="input" placeholder="Condition, dimensions, why you’re selling it" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <p className="hint">Listings created here are stored locally. In a production build this would go to your marketplace service.</p>
      </div>
      <div className="modal-foot">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-brand"
          disabled={!title.trim() || !price}
          onClick={() => {
            createListingStub({ title: title.trim(), price: Number(price), category, desc });
            ui.toast('Listing published (local demo)');
            onClose();
          }}
        >
          Publish listing
        </button>
      </div>
    </Modal>
  );
}

function useMarketHelpers() {
  const { state, setState } = useStore();
  return {
    createListingStub: ({ title, price, category, desc }: { title: string; price: number; category: string; desc: string }) => {
      setState((s) => ({
        ...s,
        listings: [
          {
            id: `l-${Date.now()}`,
            title,
            price,
            category,
            desc: desc || 'No description provided.',
            condition: 'Brand new',
            image: '/assets/photos/desk.jpg',
            sellerId: s.meId,
            place: 'Your neighborhood',
          },
          ...s.listings,
        ],
      }));
      void state;
    },
  };
}

export function ListingPage({ id }: { id: string }) {
  const { state, user, toggleListingSave, startConversation } = useStore();
  const ui = useUI();
  const listing = state.listings.find((l) => l.id === id) ?? state.listings[0];
  const seller = user(listing.sellerId);

  return (
    <div className="page-wrap mid">
      <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', minWidth: 0 }}>
          <img className="market-detail-img" src={listing.image} alt="" />
        </div>
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <div className="card card-pad">
            <div className="mc-price" style={{ fontSize: 30 }}>${listing.price.toLocaleString()}</div>
            <h1 style={{ fontSize: 22, letterSpacing: '-.03em', marginTop: 4, lineHeight: 1.25 }}>{listing.title}</h1>
            <div className="row" style={{ gap: 6, marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>
              <MapPin size={14} /> {listing.place}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 4, color: 'var(--muted)', fontSize: 13 }}>
              <Check size={14} /> {listing.condition} · Listed {listing.id.startsWith('l-') ? 'today' : '2 days ago'}
            </div>
            <div className="divider" />
            <div className="row" style={{ gap: 10 }}>
              <Avatar user={seller} size={44} />
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{seller.name}</div>
                <div className="hint">Usually responds within an hour</div>
              </div>
            </div>
            <div className="stack" style={{ gap: 8, marginTop: 14 }}>
              <button
                className="btn btn-brand btn-block btn-lg"
                onClick={() => {
                  const conv = startConversation(seller.id);
                  navigate(`/messages/${conv}`);
                  ui.toast('Messenger opened — listing sellers usually reply fast');
                }}
              >
                <MessageCircle size={17} /> Message seller
              </button>
              <button className="btn btn-soft btn-block" onClick={() => { toggleListingSave(listing.id); ui.toast(listing.saved ? 'Removed from saved' : 'Saved listing'); }}>
                <Bookmark size={16} /> {listing.saved ? 'Saved' : 'Save listing'}
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => ui.toast('Listing link copied (demo)')}>
                <Share2 size={16} /> Share
              </button>
            </div>
          </div>
          <div className="card card-pad" style={{ marginTop: 14 }}>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>Details</h3>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>{listing.desc}</p>
            <div className="divider" />
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
              <span>Category</span>
              <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>{listing.category}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              <span>Delivery</span>
              <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Local pickup only</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="section-title" style={{ margin: '26px 0 12px' }}>More from this seller</h2>
      <div className="market-grid">
        {state.listings.filter((l) => l.sellerId === listing.sellerId && l.id !== listing.id).map((l) => (
          <a key={l.id} href={`#/marketplace/${l.id}`} className="card market-card">
            <div className="mc-img"><img src={l.image} alt="" /></div>
            <div className="mc-body">
              <div className="mc-price">${l.price.toLocaleString()}</div>
              <div className="mc-title clamp-2">{l.title}</div>
            </div>
          </a>
        ))}
        {state.listings.filter((l) => l.sellerId === listing.sellerId).length <= 1 && (
          <div className="hint" style={{ padding: 12 }}>{nfmt(1)} listing from {seller.name}.</div>
        )}
      </div>
    </div>
  );
}
