import { ArrowRight, Asterisk, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, MapPin, Plus, SlidersHorizontal, Sparkles, UsersRound } from 'lucide-react'
import './App.css'

const members = [
  { name: 'Kyle', initials: 'KZ', color: 'violet', interest: 'Coffee & exploring' },
  { name: 'Brad', initials: 'BS', color: 'blue', interest: 'Good food & outdoors' },
  { name: 'Avinash', initials: 'AS', color: 'orange', interest: 'Art & new places' },
  { name: 'Nazar', initials: 'NZ', color: 'green', interest: 'Walks & conversation' },
]

function App() {
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#plans"><Asterisk size={30} strokeWidth={2.5} />Kusama<span>beta</span></a>
      <button className="workspace-switch"><span className="workspace-mark">W</span><span>The weekend people<small>Personal workspace</small></span><ChevronDown size={14} /></button>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <a className="nav-item active" href="#plans"><CalendarDays size={18} /><span>Plans</span><span className="nav-count">1</span></a>
        <a className="nav-item" href="#preferences"><SlidersHorizontal size={18} /><span>Your preferences</span></a>
        <a className="nav-item" href="#group"><UsersRound size={18} /><span>Your group</span><span className="nav-count">4</span></a>
      </nav>
      <div className="sidebar-bottom"><div className="demo-label"><span />Demo workspace</div><div className="account"><span className="avatar violet">KZ</span><span>Kyle Zhang<small>Personal account</small></span></div></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div><span>The weekend people</span><ChevronRight size={14} /><span>Plans</span></div><span className="quiet-label">A little more together</span></header>
      <div className="page-content">
        <div className="page-heading"><div><h1>Plans</h1><p>Good company. A plan everyone can get behind.</p></div><button className="button primary"><Plus size={17} />New plan</button></div>
        <div className="view-tabs"><button className="selected">Upcoming<span>1</span></button><button>Past plans<span>2</span></button></div>
        <div className="plans-layout">
          <div><article className="plan-card">
            <div className="plan-card-top"><span><Sparkles size={15} />Picked for your group</span><span className="pill">Suggested</span></div>
            <div className="plan-image"><img src="/images/cafe-terrace.png" alt="A sunlit café terrace with coffee and pastries set out for four" /><div className="date-badge"><span>SEP</span><strong>19</strong><span>SATURDAY</span></div></div>
            <div className="plan-card-body"><div className="eyebrow">COFFEE · A LITTLE EXPLORING</div><h2>A slow Saturday in the city</h2><p className="plan-description">Coffee, a walk by the water, and no one rushing anywhere.</p><div className="plan-meta"><span><Clock3 size={16} />2:00 – 5:00 PM</span><span><MapPin size={16} />Williamsburg, Brooklyn</span></div><div className="plan-fit"><Check size={14} />A little something for everyone<span>About $25 / person</span></div></div>
            <div className="plan-card-footer"><div className="avatar-stack">{members.map(m => <span key={m.name} className={'avatar ' + m.color} title={m.name}>{m.initials}</span>)}<span className="footer-note">Made for all 4 of you</span></div><button className="text-button">View plan<ArrowRight size={16} /></button></div>
          </article><div className="under-card"><Sparkles size={14} /><span>Your preferences do the planning. You do the showing up.</span></div></div>
          <aside className="context-column"><section className="group-card">
            <div className="section-heading"><h2>The group</h2><button className="icon-button" aria-label="Invite friends"><Plus size={17} /></button></div><p className="section-description">Different people. Common ground.</p>
            <div className="member-list">{members.map(m => <div className="member-row" key={m.name}><span className={'avatar ' + m.color}>{m.initials}</span><div><strong>{m.name}{m.name === 'Kyle' && <span className="you-label">you</span>}</strong><small>{m.interest}</small></div><span className="ready-mark" title="Preferences ready"><Check size={13} /></span></div>)}</div>
            <div className="readiness"><span><Check size={14} />Everyone’s ready</span><span>4 of 4</span></div><div className="readiness-bar"><span /></div>
          </section><section className="window-card"><span className="small-icon"><CalendarDays size={20} /></span><div className="eyebrow">NEXT SHARED WINDOW</div><h3>Saturday afternoon</h3><p>September 19 · 2:00 – 6:00 PM</p><div className="window-members">All 4 people are free<ArrowRight size={15} /></div></section><div className="agent-note"><span className="agent-symbol"><Asterisk size={23} /></span><h3>A plan that fits everyone</h3><p>Your agents find the overlap in your interests, availability, and budget.</p></div></aside>
        </div>
      </div>
    </main>
  </div>
}
export default App
