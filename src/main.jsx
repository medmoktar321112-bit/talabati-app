import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Search, ShoppingBag, LogIn, LogOut, Plus, Trash2, ShieldCheck, Store, X } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && anonKey ? createClient(url, anonKey) : null;

const demoProducts = [
  { id: 'demo-1', name: 'سماعات لاسلكية', category: 'إلكترونيات', price: 650, currency: 'MRU', description: 'صوت واضح وبطارية تدوم طويلًا', image_url: '' },
  { id: 'demo-2', name: 'حقيبة يومية', category: 'ملابس وإكسسوارات', price: 900, currency: 'MRU', description: 'تصميم عملي للاستخدام اليومي', image_url: '' },
  { id: 'demo-3', name: 'ساعة أنيقة', category: 'إكسسوارات', price: 1200, currency: 'MRU', description: 'تصميم بسيط يناسب كل الأوقات', image_url: '' }
];

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState(demoProducts);
  const [query, setQuery] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: 'إلكترونيات', price: '', description: '', image_url: '' });
  const [online, setOnline] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) { setOnline(false); return; }
    if (!session?.user) { setProfile(null); return; }
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, role').eq('id', session.user.id).maybeSingle();
      if (!active) return;
      if (error) setMessage('تعذر تحميل بيانات الحساب. تأكد من إعداد قاعدة البيانات.');
      setProfile(data || { id: session.user.id, full_name: session.user.email, role: 'user' });
    })();
    return () => { active = false; };
  }, [session]);

  const loadProducts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (!error && data) setProducts(data);
  };
  useEffect(() => { loadProducts(); }, [session]);

  const filtered = useMemo(() => products.filter(p =>
    `${p.name} ${p.category} ${p.description || ''}`.toLowerCase().includes(query.toLowerCase())
  ), [products, query]);

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    if (!supabase) { setMessage('لتفعيل تسجيل الدخول، انسخ ملف .env.example إلى .env وضع بيانات مشروع Supabase.'); setBusy(false); return; }
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        setMessage('تم إنشاء الطلب. إذا كان تأكيد البريد مفعّلًا، افتح رسالة البريد لتأكيد حسابك.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthOpen(false);
      }
    } catch (err) { setMessage(err.message || 'حدث خطأ، حاول مرة أخرى.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setProfile(null); setMessage('');
  }

  async function addProduct(e) {
    e.preventDefault();
    if (!supabase || profile?.role !== 'owner') { setMessage('إضافة المنتجات من لوحة المالك فقط بعد إعداد الحساب والصلاحيات.'); return; }
    const price = Number(newProduct.price);
    if (!newProduct.name.trim() || !Number.isFinite(price) || price < 0) { setMessage('أدخل اسم المنتج وسعرًا صحيحًا.'); return; }
    const { error } = await supabase.from('products').insert({
      name: newProduct.name.trim(), category: newProduct.category,
      price, description: newProduct.description.trim(),
      image_url: newProduct.image_url.trim() || null,
      created_by: session.user.id
    });
    if (error) setMessage('لم تتم إضافة المنتج: ' + error.message);
    else {
      setNewProduct({ name: '', category: 'إلكترونيات', price: '', description: '', image_url: '' });
      setAddOpen(false); setMessage('تمت إضافة المنتج.'); await loadProducts();
    }
  }

  async function deleteProduct(id) {
    if (!supabase || profile?.role !== 'owner') return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) setMessage('تعذر حذف المنتج: ' + error.message);
    else { setMessage('تم حذف المنتج.'); await loadProducts(); }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="طلباتك الرئيسية"><span className="brand-mark"><ShoppingBag size={22}/></span><span>طلباتك<small>اطلب ما تحتاجه بسهولة</small></span></a>
      <div className="top-actions">
        {session ? <><span className="user-pill">{profile?.role === 'owner' ? <ShieldCheck size={16}/> : null}{profile?.full_name || session.user.email}</span><button className="btn btn-quiet" onClick={signOut}><LogOut size={17}/> خروج</button></>
        : <button className="btn btn-primary" onClick={() => {setAuthOpen(true); setMode('login');}}><LogIn size={17}/> دخول / حساب جديد</button>}
      </div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Store size={15}/> تسوّق محليًا بسهولة</span>
          <h1>كل ما تبحث عنه،<br/><em>في مكان واحد.</em></h1>
          <p>اكتشف المنتجات، قارن الخيارات، وتواصل مع البائعين بسهولة.</p>
          <div className="search-box"><Search size={20}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن منتج أو فئة..." aria-label="ابحث عن منتج"/></div>
          {!online && <p className="demo-note">وضع معاينة: المنتجات تجريبية، سجّل إعدادات Supabase لتفعيل الحسابات والبيانات الحقيقية.</p>}
        </div>
        <div className="hero-art" aria-hidden="true"><div className="orb orb-one"></div><div className="orb orb-two"></div><div className="art-card"><ShoppingBag size={52}/><span>تسوّق أذكى</span><small>عروض واختيارات متنوعة</small></div><span className="float-tag tag-a">منتجات متنوعة</span><span className="float-tag tag-b">بسهولة وأمان</span></div>
      </section>

      {message && <div className="notice" role="status"><span>{message}</span><button onClick={() => setMessage('')} aria-label="إغلاق"><X size={16}/></button></div>}

      <section className="products-section">
        <div className="section-heading"><div><span className="eyebrow">اختياراتنا</span><h2>منتجات مميزة</h2><p>تصفح المنتجات المتاحة واكتشف ما يناسبك.</p></div>
          {profile?.role === 'owner' && <button className="btn btn-primary" onClick={() => setAddOpen(true)}><Plus size={18}/> إضافة منتج</button>}
        </div>
        <div className="product-grid">
          {filtered.map((p, i) => <article className="product-card" key={p.id}>
            <div className={`product-visual visual-${i % 3}`}>{p.image_url ? <img src={p.image_url} alt={p.name} onError={e => {e.currentTarget.style.display='none';}}/> : <ShoppingBag size={42}/>}<span className="category-tag">{p.category || 'منتج'}</span></div>
            <div className="product-info"><h3>{p.name}</h3><p>{p.description || 'تواصل مع البائع لمعرفة التفاصيل.'}</p><div className="product-bottom"><strong>{Number(p.price).toLocaleString('ar')} <small>{p.currency || 'MRU'}</small></strong>{profile?.role === 'owner' && !String(p.id).startsWith('demo-') && <button className="icon-btn danger" onClick={() => deleteProduct(p.id)} aria-label="حذف المنتج"><Trash2 size={17}/></button>}</div></div>
          </article>)}
        </div>
        {filtered.length === 0 && <div className="empty-state"><Search size={28}/><h3>لم نعثر على نتائج</h3><p>جرّب البحث بكلمات أخرى.</p></div>}
      </section>
      <footer><span className="footer-brand">طلباتك</span><span>نسخة أولية قابلة للتطوير</span><span>© {new Date().getFullYear()} طلباتك</span></footer>
    </main>

    {authOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target===e.currentTarget)setAuthOpen(false);}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="إغلاق"><X size={20}/></button><div className="modal-icon"><LogIn size={24}/></div>
      <h2 id="auth-title">{mode === 'login' ? 'مرحبًا بعودتك' : 'أنشئ حسابك'}</h2><p>{mode === 'login' ? 'سجّل الدخول لمتابعة استخدام طلباتك.' : 'أنشئ حسابًا جديدًا باستخدام بريدك الإلكتروني.'}</p>
      <form onSubmit={submitAuth} className="form-stack">
        {mode === 'signup' && <label>الاسم الكامل<input value={fullName} onChange={e=>setFullName(e.target.value)} required placeholder="اسمك" autoComplete="name"/></label>}
        <label>البريد الإلكتروني<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email"/></label>
        <label>كلمة المرور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} placeholder="8 أحرف على الأقل" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>
        <button className="btn btn-primary btn-wide" disabled={busy}>{busy ? 'يرجى الانتظار...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب'}</button>
      </form>
      <button className="switch-mode" onClick={() => {setMode(mode === 'login' ? 'signup' : 'login');setMessage('');}}>{mode === 'login' ? 'ليس لديك حساب؟ أنشئ حسابًا' : 'لديك حساب بالفعل؟ سجّل الدخول'}</button>
    </section></div>}

    {addOpen && <div className="modal-backdrop" onMouseDown={e => {if(e.target===e.currentTarget)setAddOpen(false);}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title">
      <button className="modal-close" onClick={() => setAddOpen(false)} aria-label="إغلاق"><X size={20}/></button><div className="modal-icon"><Plus size={24}/></div><h2 id="add-title">إضافة منتج</h2><p>سيظهر المنتج في صفحة السوق بعد حفظه.</p>
      <form onSubmit={addProduct} className="form-stack">
        <label>اسم المنتج<input value={newProduct.name} onChange={e=>setNewProduct({...newProduct,name:e.target.value})} required maxLength={100}/></label>
        <label>الفئة<select value={newProduct.category} onChange={e=>setNewProduct({...newProduct,category:e.target.value})}><option>إلكترونيات</option><option>ملابس وإكسسوارات</option><option>منزل</option><option>مواد غذائية</option><option>أخرى</option></select></label>
        <label>السعر (MRU)<input type="number" min="0" step="1" value={newProduct.price} onChange={e=>setNewProduct({...newProduct,price:e.target.value})} required/></label>
        <label>وصف مختصر<textarea value={newProduct.description} onChange={e=>setNewProduct({...newProduct,description:e.target.value})} rows="3" maxLength={500}/></label>
        <label>رابط صورة (اختياري)<input type="url" value={newProduct.image_url} onChange={e=>setNewProduct({...newProduct,image_url:e.target.value})} placeholder="https://..."/></label>
        <button className="btn btn-primary btn-wide">حفظ المنتج</button>
      </form>
    </section></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
