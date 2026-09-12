import { Fragment, useEffect, useEffectEvent, useRef, useState } from 'react'
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
  Minus,
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
  formatPlan,
  slugFromPath,
  validateRoom,
  type RoomMember,
  type RoundResult,
  type TranscriptTurn,
} from './lib/room'
import { ApiError } from './lib/api'
import {
  getGroup,
  createGroup,
  saveCity,
  savePerson,
  removePerson,
  makePlan,
  plannerStatus,
  type SharedRoom,
} from './lib/groupsApi'
import './App.css'

type CompletedRound = { result: RoundResult; members: RoomMember[]; city: string; example: boolean }
const exampleRound = (): CompletedRound => ({
  result: DEMO_ROUND,
  members: DEMO_MEMBERS,
  city: 'Brooklyn',
  example: true,
})
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
  const [room, setRoom] = useState<SharedRoom>(() => ({
    slug: slugFromPath(location.pathname),
    city: 'Brooklyn',
    members: [],
    revision: 0,
    run: null,
  }))
  const [completed, setCompleted] = useState<CompletedRound | null>(() =>
    new URLSearchParams(location.search).get('demo') === '1' ? exampleRound() : null,
  )
  const [partial, setPartial] = useState<TranscriptTurn[]>([])
  const [loading, setLoading] = useState(true)
  const [exists, setExists] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<RoomMember | 'new' | null>(null)
  const [groupDialog, setGroupDialog] = useState<'new' | 'settings' | null>(null)
  const [info, setInfo] = useState(false)
  const [account, setAccount] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [revealed, setRevealed] = useState(6)
  const controller = useRef<AbortController | null>(null)
  const readVersion = useRef(0)
  const conversation = useRef<HTMLElement | null>(null)
  const finished = completed && revealed >= completed.result.transcript.length
  const editable = editing && editing !== 'new' ? editing : null
  const runningElsewhere = room.run?.status === 'running'
  const locked = busy || saving || loading || exists === null || !!runningElsewhere

  function accept(group: SharedRoom, preserveExample = false) {
    setRoom(group)
    setExists(true)
    setPartial(group.run?.result ? [] : group.run?.transcript || [])
    if (!preserveExample)
      setCompleted(
        group.run?.result
          ? { result: group.run.result, city: group.city, members: group.members, example: false }
          : null,
      )
    setRevealed(6)
    setError(group.run?.status === 'failed' ? group.run.error || 'Please try planning again.' : '')
  }
  async function refresh(slug = room.slug, signal?: AbortSignal, preserveExample = false) {
    const version = ++readVersion.current
    setLoading(true)
    if (slug !== room.slug) {
      setExists(null)
      setRoom({ slug, city: 'Brooklyn', members: [], revision: 0, run: null })
    }
    try {
      const status = await plannerStatus().catch(() => ({ ready: false }))
      if (!signal?.aborted && version === readVersion.current) setReady(status.ready)
      const group = await getGroup(slug, signal)
      if (!signal?.aborted && version === readVersion.current) accept(group, preserveExample)
    } catch (cause) {
      if (signal?.aborted || version !== readVersion.current) return
      if (cause instanceof ApiError && cause.status === 404) {
        setExists(false)
        setRoom({ slug, city: 'Brooklyn', members: [], revision: 0, run: null })
        setPartial([])
        if (!preserveExample) setCompleted(null)
        setError('')
      } else setError(cause instanceof Error ? cause.message : 'Couldn’t load this group.')
    } finally {
      if (!signal?.aborted && version === readVersion.current) setLoading(false)
    }
  }

  const loadRoute = useEffectEvent((slug: string, signal: AbortSignal, demo: boolean) =>
    refresh(slug, signal, demo),
  )

  useEffect(() => {
    let read = new AbortController()
    // Synchronize the server-owned room when the URL changes.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadRoute(
      slugFromPath(location.pathname),
      read.signal,
      new URLSearchParams(location.search).get('demo') === '1',
    )
    const onPop = () => {
      read.abort()
      read = new AbortController()
      controller.current?.abort()
      setBusy(false)
      setGroupDialog(null)
      setEditing(null)
      const slug = slugFromPath(location.pathname)
      setExists(null)
      setRoom({ slug, city: 'Brooklyn', members: [], revision: 0, run: null })
      setPartial([])
      const example = new URLSearchParams(location.search).get('demo') === '1'
      setCompleted(example ? exampleRound() : null)
      void loadRoute(slug, read.signal, example)
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      read.abort()
      readVersion.current += 1
      controller.current?.abort()
    }
  }, [])
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
    setPartial([])
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
      const next = await makePlan(room, request.signal)
      if (!request.signal.aborted) {
        accept(next)
        if (next.run?.result)
          reveal({
            result: next.run.result,
            members: next.members,
            city: next.city,
            example: false,
          })
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
  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') || '').trim()
    const context = String(data.get('context') || '').trim()
    if (!name || !context) return
    setSaving(true)
    setFormError('')
    try {
      const next = await savePerson(room, { name, context }, editable?.id)
      invalidate()
      accept(next)
      setEditing(null)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Couldn’t save this person.')
    } finally {
      setSaving(false)
    }
  }
  async function deleteMember(id: string) {
    setSaving(true)
    setFormError('')
    try {
      const next = await removePerson(room, id)
      invalidate()
      accept(next)
      setEditing(null)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Couldn’t remove this person.')
    } finally {
      setSaving(false)
    }
  }
  async function saveGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const city = String(data.get('city') || '').trim()
    const slug = String(data.get('slug') || room.slug)
      .trim()
      .toLowerCase()
    if (!city || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return
    setSaving(true)
    setFormError('')
    try {
      const next =
        groupDialog === 'new' || !exists
          ? await createGroup(slug, city)
          : await saveCity(room, city)
      invalidate()
      accept(next)
      if (groupDialog === 'new' || !exists) history.pushState(null, '', '/g/' + next.slug)
      setGroupDialog(null)
      setNotice('Saved for everyone in the group')
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Couldn’t save the group.')
    } finally {
      setSaving(false)
    }
  }
  const transcript = completed?.result.transcript.slice(0, revealed) || partial

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
          <IconButton
            label="Start a group"
            disabled={locked}
            onClick={() => {
              setFormError('')
              setGroupDialog('new')
            }}
          >
            <Plus size={22} strokeWidth={1.6} />
          </IconButton>
        </div>
        <div className="rail-bottom">
          <IconButton label="About Kusama" onClick={() => setInfo(true)}>
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
          <button
            className="room-switcher"
            disabled={locked}
            onClick={() => {
              setFormError('')
              setGroupDialog('settings')
            }}
          >
            <span>{room.slug.replaceAll('-', ' ')}</span>
            <ChevronDown size={14} />
          </button>
          <div className="topbar-actions">
            <IconButton
              label="Refresh group"
              disabled={busy || saving || loading}
              onClick={() => void refresh()}
            >
              <RotateCcw size={16} className={loading ? 'spin' : ''} />
            </IconButton>
            <IconButton
              label="Copy group link"
              onClick={() =>
                void copy(
                  location.origin + '/g/' + room.slug,
                  'Group link copied · invite your people',
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
                <button
                  className="city-button"
                  disabled={locked}
                  onClick={() => {
                    setFormError('')
                    setGroupDialog('settings')
                  }}
                >
                  <MapPin size={14} />
                  {room.city}
                  <ChevronDown size={12} />
                </button>
                <h1 id="room-title">A plan for all of you.</h1>
              </div>
              <div className="room-controls">
                <IconButton
                  label="Edit group"
                  disabled={locked}
                  onClick={() => {
                    setFormError('')
                    setGroupDialog('settings')
                  }}
                >
                  <SlidersHorizontal size={19} />
                </IconButton>
              </div>
            </div>
            <div className="people" aria-label="Group members">
              {room.members.map((member, index) => (
                <button
                  className="person"
                  disabled={locked}
                  key={member.id}
                  onClick={() => {
                    setFormError('')
                    setEditing(member)
                  }}
                >
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
                  disabled={locked}
                  onClick={() => {
                    setFormError('')
                    if (exists) setEditing('new')
                    else setGroupDialog('settings')
                  }}
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
                {loading
                  ? 'Loading your group…'
                  : exists === null
                    ? 'Refresh to reconnect with your group.'
                    : !exists
                      ? 'Start a group. Share a link. Pull up a chair.'
                      : room.members.length === 4
                        ? 'Everyone gets a say.'
                        : room.members.length + ' of 4 people are here.'}
              </p>
              <div className="round-buttons">
                <button className="text-button" onClick={playExample} disabled={busy}>
                  <RotateCcw size={15} />
                  <span>{completed?.example ? 'Replay demo' : 'View demo'}</span>
                </button>
                <button
                  className="button primary"
                  onClick={() => void run()}
                  disabled={locked || !ready || room.members.length !== 4 || !exists}
                  title={!ready ? 'Live planning needs its services configured' : undefined}
                >
                  {busy ? <LoaderCircle size={17} className="spin" /> : null}
                  <span>{busy ? 'Finding a little common ground' : 'Make a plan'}</span>
                  {!busy && <ArrowRight size={17} />}
                </button>
              </div>
            </div>
            {!ready && !loading && (
              <p className="connection-note">
                Live planning is temporarily unavailable. You can still build your group or explore
                the example.
              </p>
            )}
            {exists === false && !loading && (
              <button
                className="button primary"
                onClick={() => {
                  setFormError('')
                  setGroupDialog('settings')
                }}
              >
                Create this group <Plus size={16} />
              </button>
            )}
            {runningElsewhere && !busy && (
              <p role="status" className="connection-note">
                Your group is making a plan.{' '}
                <button className="text-button" onClick={() => void refresh()}>
                  Check progress
                </button>
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
                    {completed.example ? 'Saved demo' : 'Completed'}
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
                  <p>You can come back to this link. The result is saved for everyone.</p>
                </div>
              ) : completed || partial.length > 0 ? (
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
                  {completed && !finished && (
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
                  <span>{completed.example ? 'An example plan' : 'For your group'}</span>
                  {finished && (
                    <IconButton
                      label="Copy itinerary"
                      onClick={() =>
                        void copy(formatPlan(completed.result.plan), 'Itinerary copied')
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
                          <a href={step.url} target="_blank" rel="noopener noreferrer">
                            <h3>{step.title}</h3>
                            <ArrowUpRight size={16} />
                          </a>
                          <p>{step.what}</p>
                          {step.fit && (
                            <div className="event-fit">
                              {step.fit.map((fit) => (
                                <div className={'fit-person fit-' + fit.vote} key={fit.memberId}>
                                  <span
                                    className="fit-mark"
                                    title={
                                      fit.vote === 'yes'
                                        ? 'Appeals to'
                                        : fit.vote === 'no'
                                          ? 'Less suited to'
                                          : 'Mixed fit'
                                    }
                                  >
                                    {fit.vote === 'yes' ? (
                                      <Check size={13} aria-label="Appeals to" />
                                    ) : fit.vote === 'no' ? (
                                      <Minus size={13} aria-label="Less suited to" />
                                    ) : (
                                      <CircleHelp size={13} aria-label="Mixed fit" />
                                    )}
                                  </span>
                                  <p>
                                    <strong>{fit.name}</strong> <span>— {fit.reason}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
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
                    <p className="example-footnote">
                      Check venue hours, prices, and availability before heading out.
                    </p>
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
          onClose={() => {
            if (!saving) setEditing(null)
          }}
          title={editable ? 'A little about ' + editable.name : 'Pull up a chair'}
          description="Tell your agent what matters to you. A few honest sentences are plenty."
        >
          <form className="member-form" onSubmit={saveMember}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}{' '}
                <button className="text-button" type="button" onClick={() => void refresh()}>
                  Refresh group
                </button>
              </p>
            )}
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
                  disabled={saving}
                  onClick={() => void deleteMember(editable.id)}
                >
                  Remove
                </button>
              )}
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {groupDialog && (
        <Modal
          open
          onClose={() => {
            if (!saving) setGroupDialog(null)
          }}
          title={groupDialog === 'new' ? 'Start something together' : 'Your corner of Kusama'}
        >
          <form className="group-form" onSubmit={saveGroup}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}{' '}
                <button className="text-button" type="button" onClick={() => void refresh()}>
                  Refresh group
                </button>
              </p>
            )}
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
              Anyone with the link can join and edit this group. No account needed.
            </p>
            <div className="dialog-footer">
              <button className="button primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : groupDialog === 'new' || !exists ? 'Create group' : 'Save'}
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
                The demo replays a real round recorded with Maya, Dev, Sam, and Nazar’s sample
                blurbs in Brooklyn. Live plans search the web and are saved with your group.
                Replaying the demo never changes your group’s profiles or plan.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setInfo(false)
                playExample()
              }}
            >
              Play the demo
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
