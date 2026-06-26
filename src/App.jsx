import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Browser } from '@capacitor/browser'
import { APP_VERSION } from './version'

/* ====================== CONFIG — впиши свои значения ====================== */
const SUPABASE_URL = "https://dbxhccdmovwoojigqimz.supabase.co";
// Use the PUBLISHABLE key (sb_publishable_...) — safe for client apps. NEVER the sb_secret_ key.
const SUPABASE_ANON_KEY = "sb_publishable_o-QjETHNJim0om8z0lS8-w_wsqkWnvO";
/* ========================================================================= */

const CONFIGURED = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR-PROJECT")
  && !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("YOUR-KEY");
const sb = CONFIGURED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* ===== App updates: set to your GitHub repo, e.g. "kane/job-tracker" ===== */
const GITHUB_REPO = "Dev-Oleksandr/job-tracker";
/* ======================================================================== */

// Parse "v1.2.3"/"1.2.3" → [1,2,3]; compare returns >0 if a is newer than b.
const parseSemver = (s) => String(s || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
const cmpSemver = (a, b) => { for (let i = 0; i < 3; i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };

// Checks GitHub Releases for a newer build. Releases are tagged vX.Y.Z; if the
// latest tag is greater than this build's APP_VERSION, we prompt to update.
async function checkForUpdate() {
  if (!GITHUB_REPO || GITHUB_REPO.includes("OWNER")) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const rel = await r.json();
    if (cmpSemver(parseSemver(rel.tag_name), parseSemver(APP_VERSION)) <= 0) return null;
    const apk = (rel.assets || []).find(a => a.name && a.name.endsWith('.apk'));
    return { version: rel.tag_name, url: apk ? apk.browser_download_url : rel.html_url };
  } catch (e) { return null; }
}

/* ============================== constants ============================== */
const STATUS = [
  { id: 'applied',   label: 'Applied',       color: '#3B82F6' },
  { id: 'prescreen', label: 'Pre-Screening', color: '#E0A23B' },
  { id: 'testtask',  label: 'Test Task',     color: '#2DBBC4' },
  { id: 'interview', label: 'Interview',     color: '#8B7CF6' },
  { id: 'offer',     label: 'Offer',         color: '#2FB37C' },
  { id: 'rejected',  label: 'Rejected',      color: '#E0685B' },
];
const sMeta = (id) => STATUS.find(s => s.id === id) || STATUS[0];

const SOURCES = [
  { id: 'djinni',   label: 'Djinni',   color: '#2DBBA0' },
  { id: 'dou',      label: 'DOU',      color: '#E8552D' },
  { id: 'linkedin', label: 'LinkedIn', color: '#3B82F6' },
  { id: 'telegram', label: 'Telegram', color: '#2AABEE' },
  { id: 'other',    label: 'Other',    color: '#9BA1AC' },
];
const srcMeta = (id) => SOURCES.find(s => s.id === id);
const sourceLabel = (app) => {
  if (!app || !app.source) return '';
  if (app.source === 'other') return (app.sourceOther || '').trim() || 'Other';
  const m = srcMeta(app.source); return m ? m.label : '';
};
const sourceColor = (app) => {
  if (!app || !app.source) return '#9BA1AC';
  const m = srcMeta(app.source); return m ? m.color : '#9BA1AC';
};

const AVATAR_PALETTE = [
  ['#1E2A47','#7FA8EC'], ['#2A2440','#A78BFA'], ['#15302A','#54C99A'],
  ['#3A2A1A','#E0A23B'], ['#3A1E22','#E0685B'], ['#1A2E3A','#5BB8E0'],
];
const avatar = (name='') => {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

const hex = (c, a) => {
  const n = c.replace('#',''); const r = parseInt(n.substr(0,2),16), g = parseInt(n.substr(2,2),16), b = parseInt(n.substr(4,2),16);
  return `rgba(${r},${g},${b},${a})`;
};
const TODAY = () => new Date().toISOString().slice(0,10);
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (iso) => {
  if (!iso) return '—';
  const p = iso.split('-'); if (p.length !== 3) return iso;
  return `${MONTHS[(+p[1]) - 1]} ${(+p[2])}, ${p[0]}`;
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
// History is kept sorted by date ascending → newest-dated entry is the current status.
const sortHist = (h) => [...(h || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
const blankForm = () => ({ id: null, company: '', role: '', salary: '', date: TODAY(), link: '', contact: '', notes: '', status: 'applied', source: '', sourceOther: '', history: null });

/* ============================== db mapping ============================== */
const fromDb = (r) => ({
  id: r.id, company: r.company || '', role: r.role || '', salary: r.salary || '',
  date: r.date_applied || '', link: r.link || '', contact: r.contact || '',
  source: r.source || '', sourceOther: r.source_other || '', notes: r.notes || '',
  status: r.status || 'applied', history: sortHist(Array.isArray(r.history) ? r.history : []),
  updatedAt: r.updated_at ? Date.parse(r.updated_at) : 0,
});
const toDb = (d) => ({
  company: d.company, role: d.role, salary: d.salary, date_applied: d.date || null,
  link: d.link, contact: d.contact, source: d.source || '', source_other: d.sourceOther || '',
  notes: d.notes, status: d.status, history: d.history || [], updated_at: new Date().toISOString(),
});

/* ================================ icons ================================ */
const S = (p) => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...p} />;
const Icon = {
  Bag:   (p) => <S {...p}><path d="M3 7.5h18M3 7.5v11A1.5 1.5 0 0 0 4.5 20h15a1.5 1.5 0 0 0 1.5-1.5v-11M3 7.5 8 4h8l5 3.5M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></S>,
  Eye:   (p) => <S {...p}><path d="M2.5 12C4 8.5 7.5 5 12 5s8 3.5 9.5 7c-1.5 3.5-5 7-9.5 7s-8-3.5-9.5-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8"/></S>,
  EyeOff:(p) => <S {...p}><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.4 5.2A9.3 9.3 0 0 1 12 5c4.5 0 8 3.5 9.5 7a12 12 0 0 1-2.2 3.2M6.2 6.3A12 12 0 0 0 2.5 12c1.5 3.5 5 7 9.5 7a9 9 0 0 0 3.3-.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></S>,
  Filter:(p) => <S {...p}><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></S>,
  Chevron:(p)=> <S {...p}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></S>,
  Check: (p) => <S {...p}><path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></S>,
  List:  (p) => <S {...p}><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></S>,
  Bars:  (p) => <S {...p}><path d="M5 20V10M12 20V4M19 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></S>,
  Plus:  (p) => <S {...p}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></S>,
  Back:  (p) => <S {...p}><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></S>,
  Close: (p) => <S {...p}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></S>,
  Pencil:(p) => <S {...p}><path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></S>,
  Trash: (p) => <S {...p}><path d="M5 7h14M9 7V5h6v2M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></S>,
  Link:  (p) => <S {...p}><path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></S>,
  Copy:  (p) => <S {...p}><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M5 15V5a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></S>,
  Logout:(p) => <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></S>,
};

/* ================================ ROOT ================================ */
export default function Root() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CONFIGURED) { setReady(true); return; }
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!CONFIGURED) return <ConfigNeeded />;
  if (!ready) return <Center>Loading…</Center>;
  if (!session) return <Login />;
  return <App session={session} />;
}

const Center = ({ children }) => (
  <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#9BA1AC', padding:24, textAlign:'center' }}>{children}</div>
);

function ConfigNeeded() {
  return (
    <Center>
      <div style={{ maxWidth:340 }}>
        <div style={{ width:52, height:52, borderRadius:15, background:'#2A6FDB', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <Icon.Bag width="26" height="26" style={{ color:'#fff' }} />
        </div>
        <div style={{ color:'#ECEEF1', fontWeight:700, fontSize:18 }}>Setup needed</div>
        <p style={{ fontSize:14, marginTop:8 }}>Open <code>src/App.jsx</code> and set <b>SUPABASE_URL</b> and the <b>publishable</b> key.</p>
      </div>
    </Center>
  );
}

/* ================================ LOGIN ================================ */
function Login() {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  async function submit() {
    if (!email.trim() || !password) { setErr('Email and password are required.'); return; }
    setBusy(true); setErr(''); setNotice('');
    const creds = { email: email.trim(), password };
    const { data, error } = mode === 'signup'
      ? await sb.auth.signUp(creds)
      : await sb.auth.signInWithPassword(creds);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (mode === 'signup' && !data.session) {
      // email confirmation is on — go back to the sign-in form with a note (no dead-end)
      setNotice('Confirmation email sent. Confirm your address, then sign in.');
      setMode('signin');
      return;
    }
    // success → onAuthStateChange swaps the screen
  }

  const input = { width:'100%', height:52, borderRadius:13, border:'1px solid #262B33', background:'#181B21', color:'#ECEEF1', padding:'0 16px', fontSize:15, outline:'none' };
  const label = { fontSize:12.5, fontWeight:600, color:'#9BA1AC', marginBottom:7, letterSpacing:'.2px' };

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', padding:'calc(env(safe-area-inset-top) + 8px) 32px calc(env(safe-area-inset-bottom) + 8px)', animation:'jtFade .4s ease', maxWidth:480, margin:'0 auto' }}>
      <div style={{ width:52, height:52, borderRadius:15, background:'#2A6FDB', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:28, boxShadow:'0 8px 24px rgba(42,111,219,.35)' }}>
        <Icon.Bag width="26" height="26" style={{ color:'#fff' }} />
      </div>
      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:30, fontWeight:700, letterSpacing:'-.5px', lineHeight:1.1 }}>
        {mode === 'signup' ? 'Create account' : 'Welcome back'}
      </div>
      <div style={{ fontSize:15, color:'#9BA1AC', marginTop:8 }}>Track every application, in one place.</div>

      {notice && (
        <div style={{ marginTop:24, padding:14, borderRadius:14, background:'rgba(47,179,124,.12)', color:'#7FE0BD', fontSize:13.5, lineHeight:1.45 }}>{notice}</div>
      )}
      <div style={{ marginTop: notice ? 16 : 36, display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <div style={label}>Email</div>
          <input type="email" value={email} autoComplete="email" onChange={(e)=>setEmail(e.target.value)} placeholder="you@email.com" style={input} />
        </div>
        <div>
          <div style={label}>Password</div>
          <input type="password" value={password} autoComplete={mode==='signup'?'new-password':'current-password'}
            onChange={(e)=>setPassword(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&submit()} placeholder="••••••••" style={input} />
        </div>
      </div>
      {err && <div style={{ marginTop:14, fontSize:13, color:'#E0685B', fontWeight:600 }}>{err}</div>}
      <button onClick={submit} disabled={busy} style={{ marginTop:26, height:54, border:'none', borderRadius:14, background:'#2A6FDB', color:'#fff', fontSize:16, fontWeight:700, cursor:'pointer', boxShadow:'0 8px 22px rgba(42,111,219,.35)', opacity:busy?.6:1 }}>
        {busy ? 'Please wait…' : (mode === 'signup' ? 'Create account' : 'Sign in')}
      </button>
      <div onClick={()=>{ setMode(m=>m==='signin'?'signup':'signin'); setErr(''); setNotice(''); }} style={{ textAlign:'center', marginTop:18, fontSize:13.5, color:'#6B7280', cursor:'pointer' }}>
        {mode === 'signup'
          ? <>Already have an account? <span style={{ color:'#7FA8EC', fontWeight:600 }}>Sign in</span></>
          : <>New here? <span style={{ color:'#7FA8EC', fontWeight:600 }}>Create an account</span></>}
      </div>
    </div>
  );
}

/* ================================= APP ================================= */
function App({ session }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('list');          // list | stats
  const [screen, setScreen] = useState(null);      // null | details | form
  const [selectedId, setSelectedId] = useState(null);
  const [statusEditing, setStatusEditing] = useState(false);
  const [timelineEditing, setTimelineEditing] = useState(false);
  const [filters, setFilters] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [form, setForm] = useState(blankForm());
  const [formError, setFormError] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast] = useState(null);
  const [hideSalary, setHideSalary] = useState(localStorage.getItem('jt_hideSalary') === '1');
  const [menuOpen, setMenuOpen] = useState(false);
  const [update, setUpdate] = useState(null);
  const [updDismissed, setUpdDismissed] = useState(false);
  useEffect(() => { checkForUpdate().then(setUpdate); }, []);
  const toastT = useRef(null);

  async function reload() {
    const { data, error } = await sb.from('applications').select('*').order('date_applied', { ascending: false });
    if (!error && data) setApps(data.map(fromDb));
    else if (error) console.error(error);
  }
  useEffect(() => { (async () => { await reload(); setLoading(false); })(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 1700);
  };
  const toggleSalary = () => setHideSalary(v => { const nv = !v; localStorage.setItem('jt_hideSalary', nv ? '1':'0'); return nv; });

  async function persist(id, patch) {
    const { error } = await sb.from('applications').update(patch).eq('id', id);
    if (error) { console.error(error); reload(); }
  }

  // ---------- counts / derived ----------
  const counts = {}; STATUS.forEach(s => counts[s.id] = 0);
  apps.forEach(a => counts[a.status] = (counts[a.status] || 0) + 1);
  const total = apps.length;
  const hasFilters = filters.length > 0;
  const filtered = apps
    .filter(a => !hasFilters || filters.includes(a.status))
    .slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const sel = apps.find(a => a.id === selectedId);

  // ---------- navigation ----------
  const open = (id) => { setSelectedId(id); setScreen('details'); setStatusEditing(false); setTimelineEditing(false); };
  const back = () => { setScreen(null); setStatusEditing(false); setTimelineEditing(false); };
  const addNew = () => { setFormMode('add'); setForm(blankForm()); setFormError(false); setScreen('form'); };
  const startEdit = () => { if (!sel) return; setFormMode('edit'); setForm({ ...sel }); setFormError(false); setScreen('form'); };
  const cancelForm = () => { setScreen(formMode === 'edit' ? 'details' : null); setFormError(false); };

  // ---------- mutations ----------
  async function save() {
    if (!form.company.trim() || !form.role.trim()) { setFormError(true); return; }
    const f = { ...form, sourceOther: form.source === 'other' ? (form.sourceOther || '').slice(0, 30) : '' };
    if (formMode === 'add') {
      const record = { ...f, history: [{ status: f.status, date: f.date || TODAY() }] };
      const ins = { ...toDb(record), user_id: session.user.id };
      const { data, error } = await sb.from('applications').insert(ins).select().single();
      if (error) { console.error(error); showToast('Could not save'); return; }
      const created = fromDb(data);
      setApps(p => [created, ...p]);
      setSelectedId(created.id); setScreen('details');
    } else {
      const orig = apps.find(a => a.id === f.id);
      let history = orig?.history || [];
      if (orig && orig.status !== f.status) history = [...history, { status: f.status, date: TODAY() }];
      history = sortHist(history);
      const record = { ...f, status: history[history.length - 1]?.status || f.status, history };
      setApps(p => p.map(a => a.id === f.id ? { ...record, updatedAt: Date.now() } : a));
      setScreen('details');
      persist(f.id, toDb(record));
    }
  }

  function changeStatus(id) {
    setStatusEditing(false);
    if (!sel || sel.status === id) return;
    const history = sortHist([...(sel.history || []), { status: id, date: TODAY() }]);
    const status = history[history.length - 1].status;
    setApps(p => p.map(a => a.id === sel.id ? { ...a, status, history } : a));
    persist(sel.id, { status, history, updated_at: new Date().toISOString() });
  }
  function updateHistoryDate(idx, date) {
    if (!date || !sel) return;
    const history = sortHist((sel.history || []).map((h, i) => i === idx ? { ...h, date } : h));
    const status = history[history.length - 1].status;
    setApps(p => p.map(a => a.id === sel.id ? { ...a, history, status } : a));
    persist(sel.id, { history, status, updated_at: new Date().toISOString() });
  }
  function removeHistoryEntry(idx) {
    if (!sel) return;
    const hist = sel.history || [];
    if (hist.length <= 1) return;
    const history = sortHist(hist.filter((_, i) => i !== idx));
    const status = history[history.length - 1].status;
    setApps(p => p.map(a => a.id === sel.id ? { ...a, history, status } : a));
    persist(sel.id, { history, status, updated_at: new Date().toISOString() });
    showToast('Timeline entry removed');
  }
  function doDelete() {
    const id = confirmId;
    setApps(p => p.filter(a => a.id !== id));
    setConfirmId(null); setScreen(null);
    sb.from('applications').delete().eq('id', id).then(({ error }) => { if (error) { console.error(error); reload(); } });
  }

  function tapContact(contact) {
    const email = (contact.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0];
    if (email) { try { window.open('mailto:' + email, '_blank'); } catch (e) {} showToast('Opening email…'); return; }
    try { navigator.clipboard?.writeText(contact); } catch (e) {}
    showToast('Contact copied');
  }
  function openLink(link) {
    try { window.open(/^https?:\/\//.test(link) ? link : 'https://' + link, '_blank', 'noopener'); } catch (e) {}
  }

  const setF = (k, v) => setForm(s => ({ ...s, [k]: v }));

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#0F1115', color:'#ECEEF1', position:'relative', overflow:'hidden', maxWidth:480, margin:'0 auto', paddingTop:'env(safe-area-inset-top)', paddingBottom:'env(safe-area-inset-bottom)' }}>

      {/* ===== UPDATE BANNER ===== */}
      {update && !updDismissed && (
        <div style={{ flex:'0 0 auto', display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(42,111,219,.14)', borderBottom:'1px solid rgba(42,111,219,.35)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#2A6FDB', flex:'0 0 auto' }} />
          <div style={{ flex:1, fontSize:13, fontWeight:600, color:'#ECEEF1' }}>New version {update.version} available</div>
          <button onClick={() => Browser.open({ url: update.url })} style={{ height:32, padding:'0 14px', borderRadius:9, border:'none', background:'#2A6FDB', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>Update</button>
          <div onClick={() => setUpdDismissed(true)} style={{ cursor:'pointer', color:'#9BA1AC', padding:4, display:'flex' }}><Icon.Close width="16" height="16" /></div>
        </div>
      )}

      {/* ===== HOME ===== */}
      {screen === null && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
          {/* header */}
          <div style={{ padding:'14px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:25, fontWeight:700, letterSpacing:'-.4px' }}>{tab === 'stats' ? 'Insights' : 'Applications'}</div>
              <div style={{ fontSize:13, color:'#9BA1AC', marginTop:2 }}>{tab === 'stats' ? 'Your search at a glance' : `${total} ${total === 1 ? 'application' : 'applications'} tracked`}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div onClick={toggleSalary} title="Hide salaries"
                style={{ width:40, height:40, borderRadius:12, background:hideSalary?'rgba(42,111,219,.14)':'#181B21', border:`1px solid ${hideSalary?'rgba(42,111,219,.45)':'#262B33'}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                {hideSalary ? <Icon.EyeOff width="19" height="19" style={{ color:'#7FA8EC' }} /> : <Icon.Eye width="19" height="19" style={{ color:'#9BA1AC' }} />}
              </div>
              <div style={{ position:'relative' }}>
                <div onClick={() => setMenuOpen(o => !o)} title={session.user.email}
                  style={{ width:40, height:40, borderRadius:'50%', background:menuOpen?'rgba(42,111,219,.14)':'#181B21', border:`1px solid ${menuOpen?'rgba(42,111,219,.45)':'#262B33'}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#7FA8EC', fontSize:14, cursor:'pointer' }}>
                  {(session.user.email?.[0] || 'Y').toUpperCase()}
                </div>
                {menuOpen && (
                  <>
                    <div onClick={() => setMenuOpen(false)} style={{ position:'fixed', inset:0, zIndex:40 }} />
                    <div style={{ position:'absolute', right:0, top:48, zIndex:41, minWidth:210, background:'#1B1E25', border:'1px solid #2C323C', borderRadius:14, padding:6, boxShadow:'0 18px 44px rgba(0,0,0,.55)', animation:'jtPop .15s ease', transformOrigin:'top right' }}>
                      <div style={{ padding:'10px 12px 11px', fontSize:12.5, color:'#9BA1AC', borderBottom:'1px solid #2C323C', marginBottom:4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{session.user.email}</div>
                      <div onClick={() => { setMenuOpen(false); sb.auth.signOut(); }} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 12px', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:600, color:'#E0685B' }}>
                        <Icon.Logout width="17" height="17" />Log out
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* LIST TAB */}
          {tab === 'list' && (
            <div className="jt-scroll" style={{ flex:1, overflowY:'auto', padding:'4px 16px 110px' }}>
              {/* filter */}
              <div style={{ position:'relative', padding:'4px 4px 12px', zIndex:10 }}>
                <div onClick={() => setFilterOpen(o => !o)} style={{ height:44, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', borderRadius:13, border:'1px solid #262B33', background:'#181B21', cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                    <Icon.Filter width="16" height="16" style={{ color:'#9BA1AC' }} />
                    <span style={{ fontSize:14, fontWeight:600, color:hasFilters?'#ECEEF1':'#9BA1AC', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {!hasFilters ? 'All statuses' : filters.length === 1 ? sMeta(filters[0]).label : `${filters.length} statuses selected`}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:9, flex:'0 0 auto' }}>
                    {hasFilters && <span style={{ fontSize:11, fontWeight:700, background:'#2A6FDB', color:'#fff', minWidth:20, height:20, padding:'0 6px', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>{filters.length}</span>}
                    <Icon.Chevron width="18" height="18" style={{ color:'#9BA1AC', transform:filterOpen?'rotate(180deg)':'rotate(0deg)', transition:'transform .2s ease' }} />
                  </div>
                </div>
                {filterOpen && (
                  <>
                  <div onClick={() => setFilterOpen(false)} style={{ position:'fixed', inset:0, zIndex:20 }} />
                  <div style={{ position:'absolute', left:4, right:4, top:52, zIndex:21, background:'#1B1E25', border:'1px solid #2C323C', borderRadius:14, padding:6, boxShadow:'0 18px 44px rgba(0,0,0,.55)', animation:'jtPop .15s ease', transformOrigin:'top' }}>
                    {STATUS.map(s => {
                      const checked = filters.includes(s.id);
                      return (
                        <div key={s.id} onClick={() => setFilters(f => f.includes(s.id) ? f.filter(x => x !== s.id) : [...f, s.id])}
                          style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 12px', borderRadius:10, cursor:'pointer', background:checked?'rgba(42,111,219,.10)':'transparent' }}>
                          <div style={{ width:20, height:20, borderRadius:6, border:`2px solid ${checked?'#2A6FDB':'#3A414C'}`, background:checked?'#2A6FDB':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto' }}>
                            {checked && <Icon.Check width="12" height="12" style={{ color:'#fff' }} />}
                          </div>
                          <span style={{ width:9, height:9, borderRadius:'50%', background:s.color }} />
                          <span style={{ flex:1, fontSize:14, fontWeight:600, color:'#ECEEF1' }}>{s.label}</span>
                          <span style={{ fontSize:13, color:'#6B7280' }}>{counts[s.id]}</span>
                        </div>
                      );
                    })}
                    <div onClick={() => { setFilters([]); setFilterOpen(false); }} style={{ marginTop:4, padding:12, textAlign:'center', fontSize:13, fontWeight:700, color:hasFilters?'#E0685B':'#6B7280', cursor:'pointer', borderTop:'1px solid #2C323C' }}>Clear filters</div>
                  </div>
                  </>
                )}
              </div>

              {/* cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
                {filtered.map(a => {
                  const m = sMeta(a.status); const [abg, acol] = avatar(a.company);
                  return (
                    <div key={a.id} onClick={() => open(a.id)} style={{ background:'#181B21', border:'1px solid #20242C', borderRadius:16, padding:14, display:'flex', gap:13, alignItems:'center', cursor:'pointer', animation:'jtUp .3s ease both' }}>
                      <div style={{ width:46, height:46, flexShrink:0, borderRadius:13, background:abg, color:acol, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:18 }}>{(a.company[0] || '?').toUpperCase()}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <div style={{ fontSize:15.5, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.company}</div>
                          <div style={{ flex:'0 0 auto', height:22, padding:'0 9px', display:'flex', alignItems:'center', gap:5, borderRadius:7, fontSize:11, fontWeight:700, background:hex(m.color,.14), color:m.color }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background:m.color }} />{m.label}
                          </div>
                        </div>
                        <div style={{ fontSize:13, color:'#9BA1AC', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.role}</div>
                        <div style={{ display:'flex', gap:14, marginTop:9, fontSize:12, color:'#6B7280' }}>
                          <span style={{ color:'#B9BEC7', fontWeight:600 }}>{a.salary ? (hideSalary ? '••••' : a.salary) : '—'}</span>
                          <span>{fmtDate(a.date)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div style={{ textAlign:'center', padding:'60px 20px', color:'#6B7280' }}>
                  <div style={{ fontSize:15, fontWeight:600, color:'#9BA1AC' }}>Nothing here yet</div>
                  <div style={{ fontSize:13, marginTop:6 }}>{loading ? 'Loading…' : 'Tap + to add your first application.'}</div>
                </div>
              )}
            </div>
          )}

          {/* STATS TAB */}
          {tab === 'stats' && (
            <div className="jt-scroll" style={{ flex:1, overflowY:'auto', padding:'4px 20px 110px', animation:'jtFade .3s ease' }}>
              <div style={{ display:'flex', gap:12, marginBottom:18 }}>
                <div style={{ flex:1, background:'#181B21', border:'1px solid #20242C', borderRadius:16, padding:16 }}>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:34, fontWeight:700, lineHeight:1 }}>{total}</div>
                  <div style={{ fontSize:12.5, color:'#9BA1AC', marginTop:6 }}>Total applications</div>
                </div>
                <div style={{ flex:1, background:'#181B21', border:'1px solid #20242C', borderRadius:16, padding:16 }}>
                  <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:34, fontWeight:700, lineHeight:1, color:'#8B7CF6' }}>{apps.filter(a => a.status !== 'rejected' && a.status !== 'offer').length}</div>
                  <div style={{ fontSize:12.5, color:'#9BA1AC', marginTop:6 }}>In progress</div>
                </div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'#9BA1AC', letterSpacing:'.3px', marginBottom:12 }}>BY STATUS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {STATUS.map(s => {
                  const maxc = Math.max(1, ...STATUS.map(x => counts[x.id]));
                  const pct = total ? Math.round(counts[s.id] / total * 100) : 0;
                  return (
                    <div key={s.id}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13.5, fontWeight:600 }}><span style={{ width:9, height:9, borderRadius:'50%', background:s.color }} />{s.label}</div>
                        <div style={{ fontSize:13, color:'#9BA1AC' }}><span style={{ color:'#ECEEF1', fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>{counts[s.id]}</span> · {pct}%</div>
                      </div>
                      <div style={{ height:8, borderRadius:5, background:'#20242C', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${counts[s.id] / maxc * 100}%`, background:s.color, borderRadius:5, transition:'width .4s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FAB */}
          <div onClick={addNew} style={{ position:'absolute', right:20, bottom:84, width:58, height:58, borderRadius:18, background:'#2A6FDB', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 10px 26px rgba(42,111,219,.45)', zIndex:5 }}>
            <Icon.Plus width="26" height="26" style={{ color:'#fff' }} />
          </div>

          {/* BOTTOM NAV */}
          <div style={{ flex:'0 0 auto', height:68, background:'#14171C', borderTop:'1px solid #20242C', display:'flex', alignItems:'stretch' }}>
            <div onClick={() => setTab('list')} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, cursor:'pointer', color:tab==='list'?'#2A6FDB':'#6B7280' }}>
              <Icon.List width="23" height="23" /><span style={{ fontSize:11, fontWeight:600 }}>Applications</span>
            </div>
            <div onClick={() => setTab('stats')} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, cursor:'pointer', color:tab==='stats'?'#2A6FDB':'#6B7280' }}>
              <Icon.Bars width="23" height="23" /><span style={{ fontSize:11, fontWeight:600 }}>Stats</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== DETAILS ===== */}
      {screen === 'details' && sel && (
        <Details sel={sel} hideSalary={hideSalary} statusEditing={statusEditing} timelineEditing={timelineEditing}
          onBack={back} onEdit={startEdit} onAskDelete={() => setConfirmId(sel.id)}
          onToggleStatusEdit={() => setStatusEditing(v => !v)} onToggleTimelineEdit={() => setTimelineEditing(v => !v)}
          onChangeStatus={changeStatus} onHistoryDate={updateHistoryDate} onHistoryRemove={removeHistoryEntry}
          onTapContact={tapContact} onOpenLink={openLink} />
      )}

      {/* ===== FORM ===== */}
      {screen === 'form' && (
        <Form mode={formMode} form={form} setF={setF} error={formError}
          onCancel={cancelForm} onSave={save}
          onSource={(id) => setForm(s => ({ ...s, source: s.source === id ? '' : id }))}
          onSourceOther={(v) => setF('sourceOther', (v || '').slice(0, 30))} />
      )}

      {/* ===== TOAST ===== */}
      {toast && (
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:96, zIndex:30, background:'#272D36', border:'1px solid #39414C', color:'#ECEEF1', fontSize:13.5, fontWeight:600, padding:'11px 18px', borderRadius:12, boxShadow:'0 10px 30px rgba(0,0,0,.5)', animation:'jtUp .2s ease', display:'flex', alignItems:'center', gap:9, whiteSpace:'nowrap' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#2FB37C' }} />{toast}
        </div>
      )}

      {/* ===== DELETE CONFIRM ===== */}
      {confirmId != null && (
        <div style={{ position:'absolute', inset:0, background:'rgba(8,9,12,.72)', display:'flex', alignItems:'flex-end', zIndex:20, animation:'jtFade .2s ease' }}>
          <div style={{ width:'100%', background:'#181B21', borderTop:'1px solid #262B33', borderRadius:'24px 24px 0 0', padding:'24px 22px 26px', animation:'jtUp .25s ease' }}>
            <div style={{ fontSize:18, fontWeight:700 }}>Delete this application?</div>
            <div style={{ fontSize:14, color:'#9BA1AC', marginTop:8, lineHeight:1.5 }}>{apps.find(a => a.id === confirmId)?.company} will be permanently removed. This can't be undone.</div>
            <div style={{ display:'flex', gap:12, marginTop:22 }}>
              <button onClick={() => setConfirmId(null)} style={{ flex:1, height:52, borderRadius:14, border:'1px solid #2C323C', background:'transparent', color:'#ECEEF1', fontSize:15, fontWeight:600, cursor:'pointer' }}>Keep</button>
              <button onClick={doDelete} style={{ flex:1, height:52, border:'none', borderRadius:14, background:'#E0685B', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== DETAILS ============================== */
function Details({ sel, hideSalary, statusEditing, timelineEditing, onBack, onEdit, onAskDelete, onToggleStatusEdit, onToggleTimelineEdit, onChangeStatus, onHistoryDate, onHistoryRemove, onTapContact, onOpenLink }) {
  const m = sMeta(sel.status); const [abg, acol] = avatar(sel.company);
  const hist = sel.history || [];
  const tl = hist.slice().reverse();
  const canRemove = hist.length > 1;

  const fields = [];
  fields.push({ label:'Date applied', value:fmtDate(sel.date), color:'#ECEEF1' });
  if (sel.source) fields.push({ label:'Source', value:sourceLabel(sel), color:sourceColor(sel) });
  if (sel.salary) fields.push({ label:'Salary', value:hideSalary?'••••':sel.salary, color:'#ECEEF1' });
  if (sel.contact) fields.push({ label:'Contact', value:sel.contact, color:'#ECEEF1', isContact:true, onTap:() => onTapContact(sel.contact) });
  if (sel.link) fields.push({ label:'Job link', value:sel.link.replace(/^https?:\/\//,''), color:'#7FA8EC', isLink:true, onTap:() => onOpenLink(sel.link) });

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, animation:'jtFade .25s ease' }}>
      <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div onClick={onBack} style={{ width:42, height:42, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon.Back width="24" height="24" style={{ color:'#ECEEF1' }} /></div>
        <div style={{ display:'flex', gap:6 }}>
          <div onClick={onEdit} style={{ height:38, padding:'0 16px', borderRadius:11, border:'1px solid #2C323C', background:'#181B21', display:'flex', alignItems:'center', gap:7, fontSize:13.5, fontWeight:600, cursor:'pointer' }}><Icon.Pencil width="15" height="15" style={{ color:'#ECEEF1' }} />Edit</div>
          <div onClick={onAskDelete} style={{ width:38, height:38, borderRadius:11, border:'1px solid #3A2A2C', background:'#1E1618', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon.Trash width="16" height="16" style={{ color:'#E0685B' }} /></div>
        </div>
      </div>

      <div className="jt-scroll" style={{ flex:1, overflowY:'auto', padding:'6px 20px 30px' }}>
        <div style={{ display:'flex', gap:14, alignItems:'center' }}>
          <div style={{ width:58, height:58, flexShrink:0, borderRadius:16, background:abg, color:acol, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:23 }}>{(sel.company[0]||'?').toUpperCase()}</div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700, letterSpacing:'-.3px' }}>{sel.company}</div>
            <div style={{ fontSize:14, color:'#9BA1AC', marginTop:2 }}>{sel.role}</div>
          </div>
        </div>

        {/* status */}
        <div style={{ marginTop:22, fontSize:12.5, fontWeight:700, color:'#9BA1AC', letterSpacing:'.3px', marginBottom:10 }}>STATUS</div>
        <div onClick={onToggleStatusEdit} style={{ height:44, padding:'0 8px 0 14px', display:'inline-flex', alignItems:'center', gap:10, borderRadius:12, fontSize:14.5, fontWeight:700, background:hex(m.color,.14), color:m.color, cursor:'pointer', border:`1px solid ${hex(m.color, statusEditing?.55:.28)}` }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:m.color }} />{m.label}
          <span style={{ width:26, height:26, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', background:hex(m.color,.16) }}>
            <Icon.Chevron width="16" height="16" style={{ color:m.color, transform:statusEditing?'rotate(180deg)':'rotate(0deg)', transition:'transform .2s ease' }} />
          </span>
        </div>
        {statusEditing && (
          <div style={{ marginTop:10, background:'#181B21', border:'1px solid #2C323C', borderRadius:14, padding:12, animation:'jtPop .15s ease', transformOrigin:'top left' }}>
            <div style={{ fontSize:12.5, color:'#9BA1AC', marginBottom:11 }}>Move this application to:</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {STATUS.map(s => {
                const on = sel.status === s.id;
                return (
                  <div key={s.id} onClick={() => onChangeStatus(s.id)} style={{ height:36, padding:'0 14px', display:'flex', alignItems:'center', gap:7, borderRadius:10, fontSize:12.5, fontWeight:600, cursor:'pointer', border:`1px solid ${on?s.color:'#262B33'}`, background:on?hex(s.color,.16):'#181B21', color:on?'#ECEEF1':'#9BA1AC' }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', background:s.color }} />{s.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* fields */}
        <div style={{ marginTop:24, background:'#181B21', border:'1px solid #20242C', borderRadius:16, overflow:'hidden' }}>
          {fields.map((f, i) => (
            <div key={i} onClick={f.onTap} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'14px 16px', borderBottom:i<fields.length-1?'1px solid #20242C':'none', cursor:f.onTap?'pointer':'default' }}>
              <div style={{ fontSize:13, color:'#9BA1AC', flex:'0 0 auto' }}>{f.label}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, justifyContent:'flex-end' }}>
                <span style={{ fontSize:14, fontWeight:600, textAlign:'right', color:f.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.value}</span>
                {f.isLink && <span style={{ flex:'0 0 auto', width:28, height:28, borderRadius:8, background:'rgba(42,111,219,.14)', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon.Link width="14" height="14" style={{ color:'#7FA8EC' }} /></span>}
                {f.isContact && <span style={{ flex:'0 0 auto', width:28, height:28, borderRadius:8, background:'#22272F', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon.Copy width="14" height="14" style={{ color:'#9BA1AC' }} /></span>}
              </div>
            </div>
          ))}
        </div>

        {/* notes */}
        {sel.notes && sel.notes.trim() && (
          <div style={{ marginTop:18 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'#9BA1AC', letterSpacing:'.3px', marginBottom:9 }}>NOTES</div>
            <div style={{ background:'#181B21', border:'1px solid #20242C', borderRadius:14, padding:'14px 16px', fontSize:14, lineHeight:1.55, color:'#C7CCD4' }}>{sel.notes}</div>
          </div>
        )}

        {/* timeline */}
        <div style={{ marginTop:22 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <span style={{ fontSize:12.5, fontWeight:700, color:'#9BA1AC', letterSpacing:'.3px' }}>TIMELINE</span>
            <div onClick={onToggleTimelineEdit} style={{ height:28, padding:'0 11px', display:'flex', alignItems:'center', gap:6, borderRadius:8, border:'1px solid #2C323C', background:'#181B21', fontSize:12, fontWeight:600, color:'#7FA8EC', cursor:'pointer' }}><Icon.Pencil width="12" height="12" style={{ color:'#7FA8EC' }} />{timelineEditing ? 'Done' : 'Edit'}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {tl.map((h, i) => {
              const hm = sMeta(h.status);
              const last = i === tl.length - 1;
              const isCurrent = i === 0;
              const origIndex = hist.length - 1 - i;
              let dur = '';
              if (isCurrent) { const d = daysBetween(h.date, TODAY()); dur = d <= 0 ? 'Today' : (d === 1 ? '1 day in stage' : d + ' days in stage'); }
              else { const d = daysBetween(h.date, tl[i-1].date); dur = d <= 0 ? '' : '→ ' + (d === 1 ? '1 day' : d + ' days'); }
              return (
                <div key={origIndex} style={{ display:'flex', gap:14 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:'0 0 auto', paddingTop:2 }}>
                    <div style={{ width:14, height:14, borderRadius:'50%', background:isCurrent?hm.color:'#14171C', border:`2px solid ${hm.color}`, boxShadow:isCurrent?`0 0 0 4px ${hex(hm.color,.22)}`:'none' }} />
                    <div style={{ flex:1, width:2, background:last?'transparent':'#262B33', minHeight:last?0:(timelineEditing?40:16) }} />
                  </div>
                  <div style={{ paddingBottom:20, flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:14.5, fontWeight:700, color:isCurrent?'#ECEEF1':'#C7CCD4' }}>{hm.label}</span>
                      {isCurrent && <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.4px', color:hm.color, background:hex(hm.color,.22), padding:'2px 7px', borderRadius:6 }}>CURRENT</span>}
                    </div>
                    {!timelineEditing ? (
                      <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:3 }}>
                        <span style={{ fontSize:12.5, color:'#6B7280' }}>{fmtDate(h.date)}</span>
                        {dur && <span style={{ fontSize:12, color:'#8A919C', fontWeight:600 }}>{dur}</span>}
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                        <input type="date" value={h.date} onChange={(e) => onHistoryDate(origIndex, e.target.value)} style={{ flex:1, minWidth:0, height:40, borderRadius:10, border:'1px solid #2C323C', background:'#14171C', color:'#ECEEF1', padding:'0 12px', fontSize:13, outline:'none', colorScheme:'dark' }} />
                        {canRemove && <div onClick={() => onHistoryRemove(origIndex)} title="Remove" style={{ width:40, height:40, flex:'0 0 auto', borderRadius:10, border:'1px solid #3A2A2C', background:'#1E1618', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon.Trash width="15" height="15" style={{ color:'#E0685B' }} /></div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =============================== FORM =============================== */
function Form({ mode, form, setF, error, onCancel, onSave, onSource, onSourceOther }) {
  const input = { width:'100%', height:50, borderRadius:13, border:'1px solid #262B33', background:'#181B21', color:'#ECEEF1', padding:'0 15px', fontSize:15, outline:'none' };
  const label = { fontSize:12.5, fontWeight:600, color:'#9BA1AC', marginBottom:7 };
  const chip = (on, color) => ({ height:36, padding:'0 13px', display:'flex', alignItems:'center', gap:7, borderRadius:11, fontSize:12.5, fontWeight:600, cursor:'pointer', border:`1px solid ${on?color:'#262B33'}`, background:on?hex(color,.16):'#181B21', color:on?'#ECEEF1':'#9BA1AC' });

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, animation:'jtUp .25s ease' }}>
      <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div onClick={onCancel} style={{ width:42, height:42, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}><Icon.Close width="22" height="22" style={{ color:'#ECEEF1' }} /></div>
        <div style={{ fontSize:16, fontWeight:700 }}>{mode === 'edit' ? 'Edit application' : 'New application'}</div>
        <div style={{ width:42 }} />
      </div>

      <div className="jt-scroll" style={{ flex:1, overflowY:'auto', padding:'8px 20px 24px', display:'flex', flexDirection:'column', gap:16 }}>
        <div><div style={label}>Company *</div><input value={form.company} onChange={(e)=>setF('company',e.target.value)} placeholder="e.g. Stripe" style={input} /></div>
        <div><div style={label}>Role / title *</div><input value={form.role} onChange={(e)=>setF('role',e.target.value)} placeholder="e.g. Senior Frontend Engineer" style={input} /></div>

        <div>
          <div style={{ ...label, marginBottom:9 }}>Status</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {STATUS.map(s => (
              <div key={s.id} onClick={()=>setF('status',s.id)} style={chip(form.status===s.id, s.color)}><span style={{ width:7, height:7, borderRadius:'50%', background:s.color }} />{s.label}</div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ ...label, marginBottom:9 }}>Source</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {SOURCES.map(s => (
              <div key={s.id} onClick={()=>onSource(s.id)} style={chip(form.source===s.id, s.color)}><span style={{ width:7, height:7, borderRadius:'50%', background:s.color }} />{s.label}</div>
            ))}
          </div>
          {form.source === 'other' && (
            <div style={{ position:'relative', marginTop:10 }}>
              <input value={form.sourceOther} maxLength={30} onChange={(e)=>onSourceOther(e.target.value)} placeholder="Name the source…" style={{ ...input, padding:'0 58px 0 15px' }} />
              <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', fontSize:11.5, color:'#6B7280', fontWeight:600 }}>{(form.sourceOther || '').length}/30</span>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:12 }}>
          <div style={{ flex:1 }}><div style={label}>Salary</div><input value={form.salary} onChange={(e)=>setF('salary',e.target.value)} placeholder="$160k" style={input} /></div>
          <div style={{ flex:1 }}><div style={label}>Date applied</div><input type="date" value={form.date} onChange={(e)=>setF('date',e.target.value)} style={{ ...input, fontSize:14, colorScheme:'dark' }} /></div>
        </div>

        <div><div style={label}>Contact person</div><input value={form.contact} onChange={(e)=>setF('contact',e.target.value)} placeholder="e.g. Dana Whitfield · Recruiter" style={input} /></div>
        <div><div style={label}>Job link</div><input value={form.link} onChange={(e)=>setF('link',e.target.value)} placeholder="https://…" style={input} /></div>
        <div><div style={label}>Notes</div><textarea value={form.notes} onChange={(e)=>setF('notes',e.target.value)} placeholder="Anything worth remembering…" style={{ ...input, height:'auto', minHeight:96, padding:'13px 15px', resize:'none', lineHeight:1.5 }} /></div>

        {error && <div style={{ fontSize:13, color:'#E0685B', fontWeight:600 }}>Company and role are required.</div>}
      </div>

      <div style={{ flex:'0 0 auto', padding:'14px 20px', borderTop:'1px solid #20242C', background:'#14171C', display:'flex', gap:12 }}>
        <button onClick={onCancel} style={{ flex:'0 0 auto', padding:'0 22px', height:52, borderRadius:14, border:'1px solid #2C323C', background:'transparent', color:'#ECEEF1', fontSize:15, fontWeight:600, cursor:'pointer' }}>Cancel</button>
        <button onClick={onSave} style={{ flex:1, height:52, border:'none', borderRadius:14, background:'#2A6FDB', color:'#fff', fontSize:15.5, fontWeight:700, cursor:'pointer' }}>{mode === 'edit' ? 'Save changes' : 'Add application'}</button>
      </div>
    </div>
  );
}
