import { Fragment, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  Copy,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  UsersRound,
  X,
} from 'lucide-react'
import { AccountDialog } from './components/AccountDialog'
import { IconButton } from './components/IconButton'
import { Modal } from './components/Modal'
import type { AuthSession } from './lib/auth'
import {
  DEMO_MEMBERS,
  DEMO_ROUND,
  ROOM_STORAGE_KEY,
  readRoom,
  seedRoom,
  slugFromPath,
  validateRoom,
  type Room,
  type RoomMember,
  type RoundResult,
} from './lib/room'
import { planningPath, requestRound } from './lib/planningApi'
import './App.css'

type CompletedRound = { result: RoundResult; members: RoomMember[]; city: string; example: boolean }
const exampleRound = (): CompletedRound => ({
  result: DEMO_ROUND,
  members: DEMO_MEMBERS,
  city: 'Brooklyn',
  example: true,
})
function loadRoom(slug: string) {
  try {
    return readRoom(localStorage.getItem(ROOM_STORAGE_KEY + '.' + slug), slug)
  } catch {
    return seedRoom(slug)
  }
}
function Dotmark({ small = false }: { small?: boolean }) {
  return (
    <span className={'dotmark' + (small ? ' small' : '')} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  )
}
function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <span className={'avatar avatar-' + (index % 4)} aria-hidden="true">
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}
function App() {
  const [room, setRoom] = useState(() => loadRoom(slugFromPath(window.location.pathname)))
  const [completed, setCompleted] = useState<CompletedRound | null>(() => {
    const stored = loadRoom(slugFromPath(window.location.pathname))
    return new URLSearchParams(location.search).get('demo') === '1' ||
      (stored.city === 'Brooklyn' &&
        JSON.stringify(stored.members) === JSON.stringify(DEMO_MEMBERS))
      ? exampleRound()
      : null
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState('')
  const [editing, setEditing] = useState<RoomMember | 'new' | null>(null)
  const [groupDialog, setGroupDialog] = useState<'new' | 'settings' | null>(null)
  const [info, setInfo] = useState(false)
  const [account, setAccount] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [revealed, setRevealed] = useState(6)
  const controller = useRef<AbortController | null>(null)
  const conversation = useRef<HTMLElement | null>(null)
  const finished = completed && revealed >= completed.result.transcript.length
  const editable = editing && editing !== 'new' ? editing : null

  useEffect(() => {
    const onPop = () => {
      controller.current?.abort()
      setBusy(false)
      setRoom(loadRoom(slugFromPath(window.location.pathname)))
      setCompleted(new URLSearchParams(location.search).get('demo') === '1' ? exampleRound() : null)
      setError('')
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      controller.current?.abort()
    }
  }, [])
  useEffect(() => {
    // This effect synchronizes browser storage and reports whether that external write succeeded.
    try {
      localStorage.setItem(ROOM_STORAGE_KEY + '.' + room.slug, JSON.stringify(room))
      // oxlint-disable-next-line react/set-state-in-effect
      setStorageError('')
    } catch {
      setStorageError(
        'Your changes are available for this visit, but this browser couldn’t save them.',
      )
    }
  }, [room])
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(''), 3000)
    return () => clearTimeout(timeout)
  }, [notice])
  useEffect(() => {
    if (!completed || revealed >= completed.result.transcript.length) return
    const timeout = setTimeout(() => setRevealed((value) => value + 1), 380)
    return () => clearTimeout(timeout)
  }, [completed, revealed])

  function invalidate() {
    controller.current?.abort()
    setBusy(false)
    setCompleted(null)
    setError('')
    if (location.search || location.hash) history.replaceState(null, '', '/g/' + room.slug)
  }
  function reveal(round: CompletedRound) {
    setCompleted(round)
    setRevealed(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? round.result.transcript.length
        : 1,
    )
  }
  function playExample() {
    controller.current?.abort()
    setBusy(false)
    setError('')
    reveal(exampleRound())
    history.replaceState(null, '', '/g/' + room.slug + '?demo=1')
  }
  async function run() {
    const invalid = validateRoom(room)
    if (invalid) {
      setError(invalid)
      return
    }
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setBusy(true)
    setError('')
    setCompleted(null)
    try {
      const result = await requestRound({ city: room.city, members: room.members }, request.signal)
      if (!request.signal.aborted) {
        reveal({ result, members: structuredClone(room.members), city: room.city, example: false })
        history.replaceState(null, '', '/g/' + room.slug)
      }
    } catch (cause) {
      if (!request.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : 'Couldn’t make the plan. Please try again.',
        )
    } finally {
      if (!request.signal.aborted) setBusy(false)
    }
  }
  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice(message)
    } catch {
      setError('Your browser couldn’t copy that. You can copy the link from the address bar.')
    }
  }
  function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    const context = String(data.get('context') || '').trim()
    if (!name || !context) return
    const next = { id: editable?.id || crypto.randomUUID(), name, context }
    invalidate()
    setRoom((current) => ({
      ...current,
      members: editable
        ? current.members.map((member) => (member.id === editable.id ? next : member))
        : [...current.members, next].slice(0, 4),
    }))
    setEditing(null)
  }
  function saveGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const city = String(data.get('city') || '').trim()
    const slug = String(data.get('slug') || room.slug)
      .trim()
      .toLowerCase()
    if (!city || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return
    invalidate()
    if (groupDialog === 'new') {
      let existing: Room | null = null
      try {
        const raw = localStorage.getItem(ROOM_STORAGE_KEY + '.' + slug)
        if (raw) existing = readRoom(raw, slug)
      } catch {
        /* Storage warning is handled by the persistence effect. */
      }
      setRoom(existing || { slug, city, members: [] })
      history.pushState(null, '', '/g/' + slug)
    } else setRoom((current) => ({ ...current, city }))
    setGroupDialog(null)
  }
  const transcript = completed?.result.transcript.slice(0, revealed) || []

  return (
    <div className="app-shell">
      <a className="skip-link" href="#conversation">
        Skip to conversation
      </a>
      <aside className="app-rail" aria-label="Main navigation">
        <a className="brand" href={'/g/' + room.slug} aria-label="Kusama home">
          <Dotmark />
          <span>Kusama</span>
        </a>
        <div className="rail-actions">
          <IconButton
            label="Conversation"
            className="active"
            onClick={() =>
              conversation.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            <MessageCircle size={20} strokeWidth={1.6} />
          </IconButton>
          <IconButton label="Start a group" onClick={() => setGroupDialog('new')}>
            <Plus size={22} strokeWidth={1.6} />
          </IconButton>
        </div>
        <div className="rail-bottom">
          <IconButton label="About this example" onClick={() => setInfo(true)}>
            <CircleHelp size={19} strokeWidth={1.6} />
          </IconButton>
          <IconButton label={session ? 'Your account' : 'Sign in'} onClick={() => setAccount(true)}>
            {session ? (
              <span className="tiny-monogram">{session.user.name.slice(0, 1)}</span>
            ) : (
              <CircleUserRound size={21} strokeWidth={1.5} />
            )}
          </IconButton>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="room-switcher" onClick={() => setGroupDialog('settings')}>
            <span>{room.slug.replaceAll('-', ' ')}</span>
            <ChevronDown size={14} />
          </button>
          <div className="topbar-actions">
            <span className="local-indicator">On this device</span>
            <IconButton
              label="Copy group link"
              onClick={() =>
                void copy(
                  location.origin + '/g/' + room.slug,
                  'Group link copied · profiles stay on this device for now',
                )
              }
            >
              <Copy size={17} />
            </IconButton>
          </div>
        </header>

        <div className="room-content">
          <section className="room-intro" aria-labelledby="room-title">
            <div className="intro-heading">
              <div>
                <button className="city-button" onClick={() => setGroupDialog('settings')}>
                  <MapPin size={14} />
                  {room.city}
                  <ChevronDown size={12} />
                </button>
                <h1 id="room-title">A plan for all of you.</h1>
              </div>
              <div className="room-controls">
                <IconButton label="Edit group" onClick={() => setGroupDialog('settings')}>
                  <SlidersHorizontal size={19} />
                </IconButton>
              </div>
            </div>
            <div className="people" aria-label="Group members">
              {room.members.map((member, index) => (
                <button className="person" key={member.id} onClick={() => setEditing(member)}>
                  <div className="person-heading">
                    <Avatar name={member.name} index={index} />
                    <span>{member.name}</span>
                    <ArrowUpRight className="person-edit" size={15} />
                  </div>
                  <p>{member.context}</p>
                </button>
              ))}
              {Array.from({ length: Math.max(0, 4 - room.members.length) }, (_, index) => (
                <button
                  className="person empty-person"
                  key={'empty-' + index}
                  onClick={() => setEditing('new')}
                >
                  <span className="empty-avatar">
                    <Plus size={20} />
                  </span>
                  <span>
                    {room.members.length === 0 && index === 0
                      ? 'Add yourself'
                      : 'Room for one more'}
                  </span>
                </button>
              ))}
            </div>
            <div className="round-actions">
              <p>
                {room.members.length === 4
                  ? 'Everyone gets a say.'
                  : room.members.length + ' of 4 people are here.'}
              </p>
              <div className="round-buttons">
                <button className="text-button" onClick={playExample} disabled={busy}>
                  <RotateCcw size={15} />
                  <span>{completed?.example ? 'Replay example' : 'View example'}</span>
                </button>
                <button
                  className="button primary"
                  onClick={() => void run()}
                  disabled={busy || !planningPath || room.members.length !== 4}
                  title={!planningPath ? 'Live planning is being connected' : undefined}
                >
                  {busy ? <LoaderCircle size={17} className="spin" /> : null}
                  <span>{busy ? 'Finding a little common ground' : 'Make a plan'}</span>
                  {!busy && <ArrowRight size={17} />}
                </button>
              </div>
            </div>
            {!planningPath && (
              <p className="connection-note">
                Explore the example while live planning is being connected.
              </p>
            )}
            {storageError && (
              <p className="form-error" role="alert">
                {storageError}
              </p>
            )}
            {error && (
              <p className="form-error round-error" role="alert">
                {error}
                <button
                  className="text-button"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                >
                  <X size={15} />
                </button>
              </p>
            )}
          </section>

          <div className={'round-layout' + (!completed ? ' no-result' : '')}>
            <section
              className="conversation"
              ref={conversation}
              id="conversation"
              aria-labelledby="conversation-title"
              aria-busy={busy}
            >
              <div className="section-heading">
                <h2 id="conversation-title">Around the table</h2>
                {completed && (
                  <button className="example-badge" onClick={() => setInfo(true)}>
                    {completed.example ? 'Example' : 'Completed'}
                    <span aria-hidden="true">·</span>
                    {completed.city}
                    <ArrowUpRight size={12} />
                  </button>
                )}
              </div>
              {busy ? (
                <div className="working-state" role="status">
                  <div className="working-mark">
                    <Dotmark />
                  </div>
                  <h3>Four perspectives, coming together.</h3>
                  <p>Finding places, hearing everyone out, and putting it all into a plan.</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      controller.current?.abort()
                      setBusy(false)
                      setNotice('Planning cancelled')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : completed ? (
                <div className="transcript">
                  {transcript.map((turn, index) => (
                    <article className={'turn turn-' + turn.kind} key={index}>
                      <div className="turn-avatar">
                        {turn.kind === 'vote' ? (
                          <Avatar name={turn.speaker} index={index - 1} />
                        ) : (
                          <span className="orchestrator-avatar">
                            <Dotmark small />
                          </span>
                        )}
                      </div>
                      <div className="turn-body">
                        <div className="turn-heading">
                          <h3>{turn.kind === 'vote' ? turn.speaker : 'Kusama'}</h3>
                          <span>
                            {turn.kind === 'vote'
                              ? 'votes'
                              : turn.kind === 'search'
                                ? 'finds the overlap'
                                : 'brings it together'}
                          </span>
                          {turn.kind === 'final' && <Check size={13} />}
                        </div>
                        <p>{turn.text}</p>
                      </div>
                    </article>
                  ))}
                  {!finished && (
                    <div className="reveal-status" role="status">
                      Revealing the completed round…
                    </div>
                  )}
                  {finished && (
                    <div className="conversation-end">
                      <span />
                      <Dotmark small />
                      <span />
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-conversation">
                  <div className="empty-orbit">
                    <UsersRound size={28} strokeWidth={1.1} />
                  </div>
                  <h3>
                    Different people.
                    <br />A little common ground.
                  </h3>
                  <p>
                    Add four personal blurbs. Kusama will find places, gather each person’s vote,
                    and put the evening together.
                  </p>
                  <button className="text-button" onClick={playExample}>
                    See how it works
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>

            {completed && (
              <aside
                className={'itinerary' + (!finished ? ' awaiting-plan' : '')}
                aria-labelledby="itinerary-title"
              >
                <div className="itinerary-top">
                  <span>{completed.example ? 'An example evening' : 'Your evening'}</span>
                  {finished && (
                    <IconButton
                      label="Copy itinerary"
                      onClick={() =>
                        void copy(
                          [
                            completed.result.plan.title,
                            ...completed.result.plan.steps.map(
                              (step) =>
                                step.time + ' · ' + step.title + '\n' + step.what + '\n' + step.url,
                            ),
                            'The compromise: ' + completed.result.plan.compromise,
                          ].join('\n\n'),
                          'Itinerary copied',
                        )
                      }
                    >
                      <Copy size={16} />
                    </IconButton>
                  )}
                </div>
                {finished ? (
                  <>
                    <h2 id="itinerary-title">{completed.result.plan.title}</h2>
                    <div className="route-art" aria-hidden="true">
                      {completed.result.plan.steps.map((_, index) => (
                        <Fragment key={index}>
                          {index > 0 && <span className="route-line" />}
                          <span className="route-number">{String(index + 1).padStart(2, '0')}</span>
                        </Fragment>
                      ))}
                      <ArrowUpRight size={22} strokeWidth={1.2} />
                    </div>
                    <ol className="itinerary-steps">
                      {completed.result.plan.steps.map((step, index) => (
                        <li key={index}>
                          <div className="step-time">{step.time}</div>
                          <a href={step.url} target="_blank" rel="noopener noreferrer">
                            <h3>{step.title}</h3>
                            <ArrowUpRight size={16} />
                          </a>
                          <p>{step.what}</p>
                        </li>
                      ))}
                    </ol>
                    <div className="compromise">
                      <span className="compromise-icon">
                        <ArrowDown size={17} />
                        <ArrowUpRight size={17} />
                      </span>
                      <div>
                        <h3>The compromise</h3>
                        <p>{completed.result.plan.compromise}</p>
                      </div>
                    </div>
                    {completed.example && (
                      <p className="example-footnote">
                        Illustrative plan. Check venue hours and prices before heading out.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="plan-wait">
                    <Dotmark small />
                    <p>
                      The plan comes together
                      <br />
                      after everyone’s had a say.
                    </p>
                  </div>
                )}
              </aside>
            )}
          </div>
          <footer className="workspace-footer">
            <span>Kusama</span>
            <span>A little more together.</span>
          </footer>
        </div>
      </main>
      <div className={'toast' + (notice ? ' visible' : '')} role="status">
        {notice && (
          <>
            <Check size={16} />
            {notice}
          </>
        )}
      </div>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editable ? 'A little about ' + editable.name : 'Pull up a chair'}
          description="Tell your agent what matters to you. A few honest sentences are plenty."
        >
          <form className="member-form" onSubmit={saveMember}>
            <div className="form-field">
              <label htmlFor="member-name">Name</label>
              <input
                id="member-name"
                name="name"
                autoComplete="given-name"
                placeholder="Your name"
                defaultValue={editable?.name || ''}
                maxLength={80}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="member-context">Your context</label>
              <textarea
                id="member-context"
                name="context"
                placeholder="What do you love? What’s a hard no? Anything your friends should know…"
                defaultValue={editable?.context || ''}
                maxLength={4000}
                rows={7}
                required
              />
            </div>
            <div className="dialog-footer">
              {editable && (
                <button
                  className="text-button remove-member"
                  type="button"
                  onClick={() => {
                    invalidate()
                    setRoom((current) => ({
                      ...current,
                      members: current.members.filter((member) => member.id !== editable.id),
                    }))
                    setEditing(null)
                  }}
                >
                  Remove
                </button>
              )}
              <button className="button primary" type="submit">
                Save
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {groupDialog && (
        <Modal
          open
          onClose={() => setGroupDialog(null)}
          title={groupDialog === 'new' ? 'Start something together' : 'Your corner of Kusama'}
        >
          <form className="group-form" onSubmit={saveGroup}>
            {groupDialog === 'new' && (
              <div className="form-field">
                <label htmlFor="group-slug">Group link</label>
                <div className="slug-input">
                  <span>/g/</span>
                  <input
                    id="group-slug"
                    name="slug"
                    placeholder="friday-people"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    title="Lowercase letters, numbers, and hyphens"
                    maxLength={60}
                    required
                  />
                </div>
              </div>
            )}
            <div className="form-field">
              <label htmlFor="group-city">City</label>
              <input
                id="group-city"
                name="city"
                defaultValue={groupDialog === 'new' ? '' : room.city}
                placeholder="Brooklyn"
                maxLength={100}
                required
              />
            </div>
            <p className="account-note">
              Group profiles stay on this device while shared groups are being connected.
            </p>
            <div className="dialog-footer">
              <button className="button primary" type="submit">
                {groupDialog === 'new' ? 'Create group' : 'Save'}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {info && (
        <Modal open onClose={() => setInfo(false)} title="Four people. One round.">
          <div className="about-content">
            <p>
              Each person gives Kusama a little context. It searches for places, lets four personal
              agents vote independently, then turns their picks into an evening.
            </p>
            <p>The plan names who compromised, and why.</p>
            <div className="about-example">
              <Dotmark small />
              <p>
                This example uses Maya, Dev, Sam, and Nazar’s sample blurbs in Brooklyn. Its votes
                and itinerary are written sample data, not live agent results. Your edits stay on
                this device.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setInfo(false)
                playExample()
              }}
            >
              Play the example
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {account && (
        <AccountDialog session={session} onSession={setSession} onClose={() => setAccount(false)} />
      )}
    </div>
  )
}
export default App
