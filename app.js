// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyC8mlE5tzusC4X0nubnnpxL917JKxqTopk",
    authDomain: "ungal-asiriyar-v4.firebaseapp.com",
    projectId: "ungal-asiriyar-v4",
    storageBucket: "ungal-asiriyar-v4.firebasestorage.app",
    messagingSenderId: "871740932509",
    appId: "1:871740932509:web:312b435c3191d75571ef74",
    measurementId: "G-BZVBKPY0G0"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
window.db = db;

// ==================== STATE VARIABLES ====================
window.currentTeacher = null;
window.selectedTerm = 'term1';
window.manageFilterTerm = 'all';
window.manageFilterType = 'mcq';

const subjects1to5 = ['தமிழ்', 'ஆங்கிலம்', 'கணிதம்', 'சூழ்நிலையியல்'];
const subjects6to10 = ['தமிழ்', 'ஆங்கிலம்', 'கணிதம்', 'அறிவியல்', 'சமூக அறிவியல்'];
const subjects11to12 = ['தமிழ்', 'ஆங்கிலம்', 'கணிதம்', 'இயற்பியல்', 'வேதியியல்', 'தாவரவியல்', 'விலங்கியல்', 'உயிரியல்', 'கணினி அறிவியல்', 'வரலாறு', 'பொருளியல்'];

const subjectThemes = {
    'தமிழ்': { border:'#fb923c'}, 'ஆங்கிலம்': { border:'#3b82f6'}, 'கணிதம்': { border:'#22c55e'},
    'சூழ்நிலையியல்': { border:'#84cc16'}, 'அறிவியல்': { border:'#a855f7'}, 'சமூக அறிவியல்': { border:'#14b8a6'},
    'இயற்பியல்': { border:'#0ea5e9'}, 'வேதியியல்': { border:'#ec4899'}, 'தாவரவியல்': { border:'#22c55e'},
    'விலங்கியல்': { border:'#f97316'}, 'உயிரியல்': { border:'#a855f7'}, 'கணினி அறிவியல்': { border:'#6366f1'},
    'வரலாறு': { border:'#eab308'}, 'பொருளியல்': { border:'#84cc16'}
};

const teacherLogins = {
    'admin': { pwd: 'admin123', name: 'முதன்மை ஆசிரியர்', subject: 'all' },
    'tamil': { pwd: 'tamil123', name: 'தமிழ் ஆசிரியர்', subject: 'தமிழ்' }
};

const K_DARK = 'ua_dark'; const K_FONT = 'ua_font'; 
const K_TOPICS_MCQ = 'ua_topics_mcq'; const K_TOPICS_DESC = 'ua_topics_desc';
const LS_QUESTIONS = 'ua_questions_cache'; const LS_SCORES = 'ua_scores_cache';
const OR_FREE_MODELS = ['google/gemma-3-27b-it:free','meta-llama/llama-3.1-8b-instruct:free','mistralai/mistral-7b-instruct:free','deepseek/deepseek-r1:free'];

// ==================== HELPERS ====================
function lsGet(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch(e) { return def; } }
function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function escapeHtml(str) { return str ? String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;') : ''; }
function escapeAttr(str) { return str ? String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;') : ''; }

function lsSaveQuestion(id, data) { try { const cache = lsGet(LS_QUESTIONS, {}); cache[id] = data; lsSet(LS_QUESTIONS, cache); } catch(e) {} }
function lsDeleteQuestion(id) { try { const cache = lsGet(LS_QUESTIONS, {}); delete cache[id]; lsSet(LS_QUESTIONS, cache); } catch(e) {} }
function lsGetQuestions() { return lsGet(LS_QUESTIONS, {}); }
function lsSaveScore(data) { try { const scores = lsGet(LS_SCORES, []); scores.push({ ...data, lsId: Date.now() + Math.random() }); lsSet(LS_SCORES, scores); } catch(e) {} }
function lsGetScores() { return lsGet(LS_SCORES, []); }
function getPct(s) { return s.pct !== undefined ? s.pct : (s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0); }

// ==================== POPUP SYSTEM ====================
function showPopup(opts) {
    const overlay = document.getElementById('popup-overlay');
    document.getElementById('popup-icon').textContent = opts.icon || '💬';
    document.getElementById('popup-title').textContent = opts.title || '';
    document.getElementById('popup-msg').textContent = opts.msg || '';
    const btns = document.getElementById('popup-btns'); btns.innerHTML = '';
    overlay.style.display = 'flex';
    
    if (opts.type === 'alert') {
        const ok = document.createElement('button'); ok.className = 'pbtn pbtn-ok'; ok.textContent = opts.confirmText || '✓ சரி';
        ok.onclick = () => { overlay.style.display = 'none'; if (opts.onConfirm) opts.onConfirm(); };
        btns.appendChild(ok);
    } else {
        const cancel = document.createElement('button'); cancel.className = 'pbtn pbtn-cancel'; cancel.textContent = opts.cancelText || '✕ ரத்து';
        cancel.onclick = () => { overlay.style.display = 'none'; };
        const confirm = document.createElement('button'); confirm.className = opts.type === 'danger' ? 'pbtn pbtn-danger' : 'pbtn pbtn-confirm'; confirm.textContent = opts.confirmText || '✓ ஆம்';
        confirm.onclick = () => { overlay.style.display = 'none'; if (opts.onConfirm) opts.onConfirm(); };
        btns.appendChild(cancel); btns.appendChild(confirm);
    }
}
function popupAlert(msg, icon) { showPopup({ icon: icon||'ℹ️', title: 'தகவல்', msg: msg, type: 'alert' }); }
function popupError(msg) { showPopup({ icon: '❌', title: 'பிழை', msg: msg, type: 'alert' }); }
function popupConfirm(title, msg, onConfirm, confirmText) { showPopup({ icon: '🗑️', title: title, msg: msg, type: 'confirm', onConfirm: onConfirm, confirmText: confirmText||'🗑 நீக்கு', cancelText: '✕ ரத்து' }); }
function popupDanger(title, msg, onConfirm, confirmText) { showPopup({ icon: '⚠️', title: title, msg: msg, type: 'danger', onConfirm: onConfirm, confirmText: confirmText||'🗑 நீக்கு', cancelText: '✕ ரத்து' }); }

// ==================== UI STATE ====================
function openSheet(id) { const s = document.getElementById(id); if (!s) return; s.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeSheet(id) { const s = document.getElementById(id); if(!s) return; s.classList.remove('open'); document.body.style.overflow = ''; }

function switchTab(name) {
    document.querySelectorAll('.deck-panel').forEach(p => p.classList.remove('on'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('on'));
    const p = document.getElementById('panel-' + name); if (p) p.classList.add('on');
    document.querySelectorAll('.nav-item').forEach(b => { if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + name + "'")) b.classList.add('on'); });
    
    if (name === 'manage') loadManageQuestions();
    if (name === 'marks') loadScores();
    if (name === 'dash') loadAdminDashboard();
}

function switchMcqTab(tab) {
    ['excel','ai','bulk','single'].forEach(p => {
        const el = document.getElementById('mcq-' + p + '-panel'); if (el) el.classList.toggle('hidden', p !== tab);
        const c = document.getElementById('mc-' + p); if (c) c.classList.toggle('on', p === tab);
    });
}

function selectMcqTerm(t) { window.selectedTerm = t; document.querySelectorAll('#panel-mcq .pill[data-t]').forEach(p => p.classList.toggle('on', p.dataset.t === t)); document.getElementById('mcq-selected-term').value = t; }
function selectDescTerm(t) { document.querySelectorAll('#panel-desc .pill[data-t]').forEach(p => p.classList.toggle('on', p.dataset.t === t)); document.getElementById('desc-selected-term').value = t; }

// ==================== SETTINGS & FONT ====================
function toggleDarkMode() { 
    const d = document.body.classList.toggle('dark-mode'); 
    lsSet(K_DARK, d); 
    const cb = document.getElementById('dark-mode-toggle'); if (cb) cb.checked = d; 
}
function applyDarkMode() { 
    const isDark = lsGet(K_DARK, false); 
    if (isDark) document.body.classList.add('dark-mode'); 
    const cb = document.getElementById('dark-mode-toggle'); if (cb) cb.checked = isDark; 
}

function updateFontBtns() { 
    const isLg = document.body.classList.contains('font-lg'); 
    const nb = document.getElementById('font-btn-normal'); 
    const lb = document.getElementById('font-btn-large'); 
    if(nb) nb.classList.toggle('on', !isLg); 
    if(lb) lb.classList.toggle('on', isLg); 
}

function setFontPref(s) { 
    document.body.classList.toggle('font-lg', s === 'large'); 
    lsSet(K_FONT, s === 'large'); 
    updateFontBtns(); 
}

function applyFontSize() { 
    const isLg = lsGet(K_FONT, false); 
    if (isLg) document.body.classList.add('font-lg'); 
    updateFontBtns(); 
}

// ==================== LOGIN ====================
function doLogin() {
    const user = document.getElementById('l-user').value.trim().toLowerCase();
    const pwd = document.getElementById('l-pwd').value.trim();
    const t = teacherLogins[user];
    const err = document.getElementById('login-err');
    
    if (t && t.pwd === pwd) {
        err.classList.remove('show');
        localStorage.setItem('ua_last_teacher_user', user);
        window.currentTeacher = { username: user, name: t.name, subject: t.subject };
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('app').classList.add('on');
        document.getElementById('topbar-user').textContent = t.name;
        
        // Show Admin Danger Zone in settings if admin
        if(user === 'admin') {
            document.getElementById('admin-danger-section').style.display = 'flex';
        }
        
        updateAdminSubjects('mcq-class', 'mcq-subject'); updateAdminSubjects('desc-class', 'desc-subject');
        updateAdminSubjects('manage-class', 'manage-subject', true); updateAdminSubjects('ana-class-filter', 'ana-subject-filter', true);
        updateAdminSubjects('score-class-filter', 'score-subject-filter', true);
        
        loadMcqTopics(); loadDescTopics(); loadAdminDashboard(); loadScores();
    } else { err.classList.add('show'); }
}
function doLogout() {
    window.currentTeacher = null;
    document.getElementById('app').classList.remove('on');
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('l-pwd').value = '';
    document.getElementById('admin-danger-section').style.display = 'none';
}

// ==================== SUBJECTS & TOPICS ====================
function updateAdminSubjects(classId, subjectId, isFilter = false) {
    const classVal = document.getElementById(classId).value;
    const subSelect = document.getElementById(subjectId);
    if (!subSelect) return;
    
    const prevVal = subSelect.value;
    const isAllSubjectsAdmin = !window.currentTeacher || window.currentTeacher.subject === 'all';
    subSelect.innerHTML = (isFilter && isAllSubjectsAdmin) ? '<option value="">அனைத்து பாடம்</option>' : '';
    
    let subjects = [];
    if (['1', '2', '3', '4', '5'].includes(classVal)) subjects = subjects1to5;
    else if (['11', '12'].includes(classVal)) subjects = subjects11to12;
    else subjects = subjects6to10;
    
    if(!classVal && isFilter) subjects = [...new Set([...subjects1to5, ...subjects6to10, ...subjects11to12])]; 
    if (!isAllSubjectsAdmin) subjects = [window.currentTeacher.subject];
    
    subjects.forEach(sub => { subSelect.innerHTML += `<option value="${sub}">${sub}</option>`; });
    if(prevVal && subjects.includes(prevVal)) subSelect.value = prevVal; else if (subjects.length > 0) subSelect.value = subjects[0];
}

function initTopics() {
    let mcqTopics = lsGet(K_TOPICS_MCQ, {});
    let descTopics = lsGet(K_TOPICS_DESC, {});
    if (Object.keys(mcqTopics).length === 0) { mcqTopics = { 'தமிழ்': ['இலக்கணம்', 'இலக்கியம்'] }; lsSet(K_TOPICS_MCQ, mcqTopics); }
    if (Object.keys(descTopics).length === 0) { descTopics = { 'தமிழ்': ['இலக்கண விளக்கம்'] }; lsSet(K_TOPICS_DESC, descTopics); }
    return { mcq: mcqTopics, desc: descTopics };
}

function loadMcqTopics() {
    const subject = document.getElementById('mcq-subject').value; if(!subject) return;
    const topics = initTopics().mcq[subject] || [];
    const topicSelect = document.getElementById('mcq-topic');
    if (topicSelect) { topicSelect.innerHTML = '<option value="">📖 பாடத் தலைப்பு தேர்வு</option>'; topics.forEach(t => topicSelect.innerHTML += `<option value="${t}">${t}</option>`); }
    const listDiv = document.getElementById('mcq-topics-list');
    if (listDiv) { listDiv.innerHTML = topics.map((t, i) => `<div class="topic-pill"><span class="tp-num">${i+1}</span><span>${t}</span><button onclick="deleteMcqTopic('${subject}','${t}')">×</button></div>`).join(''); }
}
function addMcqTopic() {
    const subject = document.getElementById('mcq-subject').value; const newTopic = document.getElementById('mcq-new-topic').value.trim();
    if (!newTopic) return;
    const topics = initTopics(); if (!topics.mcq[subject]) topics.mcq[subject] = [];
    if (!topics.mcq[subject].includes(newTopic)) { topics.mcq[subject].push(newTopic); lsSet(K_TOPICS_MCQ, topics.mcq); loadMcqTopics(); }
    document.getElementById('mcq-new-topic').value = '';
}
function deleteMcqTopic(subject, topic) { popupConfirm('நீக்கு', '"' + topic + '" ஐ நீக்கவா?', () => { var topics = initTopics(); topics.mcq[subject] = topics.mcq[subject].filter(t => t !== topic); lsSet(K_TOPICS_MCQ, topics.mcq); loadMcqTopics(); }); }

function loadDescTopics() {
    const subject = document.getElementById('desc-subject').value; if(!subject) return;
    const topics = initTopics().desc[subject] || [];
    const topicSelect = document.getElementById('desc-topic');
    if (topicSelect) { topicSelect.innerHTML = '<option value="">📖 பாடத் தலைப்பு தேர்வு</option>'; topics.forEach(t => topicSelect.innerHTML += `<option value="${t}">${t}</option>`); }
    const listDiv = document.getElementById('desc-topics-list');
    if (listDiv) { listDiv.innerHTML = topics.map((t, i) => `<div class="topic-pill"><span class="tp-num">${i+1}</span><span>${t}</span><button onclick="deleteDescTopic('${subject}','${t}')">×</button></div>`).join(''); }
}
function addDescTopic() {
    const subject = document.getElementById('desc-subject').value; const newTopic = document.getElementById('desc-new-topic').value.trim();
    if (!newTopic) return;
    const topics = initTopics(); if (!topics.desc[subject]) topics.desc[subject] = [];
    if (!topics.desc[subject].includes(newTopic)) { topics.desc[subject].push(newTopic); lsSet(K_TOPICS_DESC, topics.desc); loadDescTopics(); }
    document.getElementById('desc-new-topic').value = '';
}
function deleteDescTopic(subject, topic) { popupConfirm('நீக்கு', '"' + topic + '" ஐ நீக்கவா?', () => { var topics = initTopics(); topics.desc[subject] = topics.desc[subject].filter(t => t !== topic); lsSet(K_TOPICS_DESC, topics.desc); loadDescTopics(); }); }

// ==================== DASHBOARD ====================
async function loadAdminDashboard() { 
    try { 
        const qSnap = await db.collection('questions').get(); document.getElementById('dash-questions').textContent = qSnap.size; 
        const sSnap = await db.collection('scores').get(); document.getElementById('dash-attempts').textContent = sSnap.size; 
        const students = new Set(); sSnap.forEach(d => students.add(d.data().name)); document.getElementById('dash-students').textContent = students.size; 
    } catch(e) {} 
}

// ==================== OPEN ROUTER (AI) ====================
function saveOpenRouterKey() {
    const key = document.getElementById('openrouter-key-input').value.trim(); const st = document.getElementById('api-key-status');
    if(!key || key.length < 10) { st.style.display='block'; st.style.color='var(--red)'; st.textContent='❌ Valid key இல்லை'; return; }
    localStorage.setItem('ua_openrouter_key', key); st.style.display='block'; st.style.color='var(--grn)'; st.textContent='✅ Saved!'; setTimeout(()=>{st.textContent='';},3000);
}

window._aiGeneratedQuestions = [];
async function callOpenRouter(prompt, apiKey) {
    for(const model of OR_FREE_MODELS){
        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ungal-asiriyar.app', 'X-Title': 'Ungal Asiriyar' }, body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 3000, temperature: 0.7 }) });
            if(!res.ok) continue; const data = await res.json(); const text = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ''; if(text) return {text, model};
        } catch(e) { console.warn(model, e.message); }
    }
    throw new Error('All models failed');
}

async function generateAIQuestions() {
    const topicInput=document.getElementById('ai-topic-input').value.trim(); const count=document.getElementById('ai-q-count').value; const lang=document.getElementById('ai-language').value; const classVal=document.getElementById('mcq-class').value; const subject=document.getElementById('mcq-subject').value; const statusEl=document.getElementById('ai-status'); const btn=document.getElementById('ai-generate-btn');
    if(!topicInput){statusEl.textContent='❌ Topic இல்லை';statusEl.className='smsg er';statusEl.style.display='block';return;}
    if(!classVal||!subject){statusEl.textContent='❌ வகுப்பு/பாடம் தேர்வு செய்யவும்';statusEl.className='smsg er';statusEl.style.display='block';return;}
    const apiKey=localStorage.getItem('ua_openrouter_key')||'';
    if(!apiKey){statusEl.innerHTML='❌ API Key இல்லை! Settings-ல் சேர்க்கவும்';statusEl.className='smsg er';statusEl.style.display='block';return;}
    btn.disabled=true;btn.textContent='⏳ Generating…';statusEl.textContent=`AI ${count} questions உருவாக்குகிறது…`;statusEl.className='smsg';statusEl.style.display='block';document.getElementById('ai-preview').style.display='none';
    const langInstr=lang==='tamil'?'All questions MUST be in Tamil script only.':lang==='english'?'English only.':'Mix Tamil and English.';
    const prompt=`Create ${count} MCQ questions for Class ${classVal} ${subject}, Topic: "${topicInput}". ${langInstr}\nReturn ONLY a JSON array:\n[{"question":"...","option1":"...","option2":"...","option3":"...","option4":"...","answer":"exact correct option text"}]`;
    try {
        const {text, model} = await callOpenRouter(prompt, apiKey); const clean = text.replace(/\`\`\`json|\`\`\`/g,'').trim(); const si = clean.indexOf('['), ei = clean.lastIndexOf(']'); if(si===-1) throw new Error('JSON not found');
        const questions = JSON.parse(clean.substring(si, ei+1)); const valid = questions.filter(q => q.question && q.option1 && q.option2 && q.answer); if(!valid.length) throw new Error('No valid questions'); window._aiGeneratedQuestions = valid;
        document.getElementById('ai-preview-count').textContent = `✅ ${valid.length} questions generated (${model.split('/')[1]})`;
        let html=''; valid.forEach((q,i) => { html += `<div style="background:var(--bg);border-radius:var(--r3);padding:11px;margin-bottom:7px;"><div style="font-size:13px;font-weight:600;margin-bottom:7px;">${i+1}. ${q.question}</div><div style="display:flex;flex-wrap:wrap;gap:5px;">${[q.option1,q.option2,q.option3,q.option4].map((o,j)=>`<span style="font-size:11px;padding:4px 9px;border-radius:8px;font-weight:600;background:${o===q.answer?'var(--grn-lt)':'#fff'};color:${o===q.answer?'var(--grn)':'var(--text2)'};border:1px solid ${o===q.answer?'rgba(16,185,129,.3)':'var(--border)'};">${['A','B','C','D'][j]} ${o}${o===q.answer?' ✓':''}</span>`).join('')}</div></div>`; });
        document.getElementById('ai-questions-list').innerHTML = html; document.getElementById('ai-preview').style.display = 'block';
        statusEl.textContent='✅ Ready to save!';statusEl.className='smsg ok';
    } catch(err) { statusEl.textContent='❌ '+err.message;statusEl.className='smsg er'; }
    btn.disabled=false;btn.textContent='✦ AI Generate';
}

async function uploadAIQuestions() {
    const questions=window._aiGeneratedQuestions||[]; const classVal=document.getElementById('mcq-class').value; const subject=document.getElementById('mcq-subject').value; const topic=document.getElementById('mcq-topic').value; const term=document.getElementById('mcq-selected-term').value; const statusEl=document.getElementById('ai-status');
    if(!classVal||!subject||!topic||!term){statusEl.textContent='❌ வகுப்பு/பாடம்/தலைப்பு/Term தேர்வு செய்யவும்';statusEl.className='smsg er';statusEl.style.display='block';return;}
    if(!questions.length){statusEl.textContent='❌ Generate first';statusEl.className='smsg er';statusEl.style.display='block';return;}
    statusEl.textContent='⏳ Saving…';statusEl.className='smsg';statusEl.style.display='block';
    try {
        const batch=db.batch(); questions.forEach(q=>{const ref=db.collection('questions').doc();const data={...q,type:'mcq',class:classVal,subject,topic,term,difficulty:'medium',createdAt:new Date().toISOString()};batch.set(ref,data);lsSaveQuestion(ref.id,data);}); await batch.commit();
        statusEl.textContent=`✅ ${questions.length} questions saved!`;statusEl.className='smsg ok'; document.getElementById('ai-preview').style.display='none'; document.getElementById('ai-topic-input').value=''; window._aiGeneratedQuestions=[]; setTimeout(()=>{statusEl.style.display='none';},4000); loadManageQuestions();
    } catch(err) { statusEl.textContent='❌ '+err.message;statusEl.className='smsg er'; }
}

// ==================== EXCEL & BULK UPLOAD ====================
function downloadExcelTemplate() {
    try {
        const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet([['Question','Option A','Option B','Option C','Option D','Correct Answer'],['Sample Q?','A','B','C','D','A']]); ws['!cols']=[{wch:40},{wch:20},{wch:20},{wch:20},{wch:20},{wch:20}]; XLSX.utils.book_append_sheet(wb,ws,'Questions');
        const wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'}); const blob=new Blob([new Uint8Array(wbout)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='MCQ_Template.xlsx';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),2000);
    } catch(e) { popupAlert('Download failed','⚠️'); }
}

window._excelParsedQuestions=[];
function handleExcelFile(input) {
    const file=input.files[0];if(!file)return; document.getElementById('excel-file-name').textContent='📄 '+file.name;
    const reader=new FileReader(); reader.onload=(e)=>{
        try {
            const wb=XLSX.read(e.target.result,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''}); const firstCell=rows[0]?String(rows[0][0]||''):''; const startRow=(firstCell.toLowerCase().includes('question')||firstCell.includes('கேள்வி'))?1:0;
            const questions=[]; for(let i=startRow;i<rows.length;i++){ const r=rows[i]; const q=String(r[0]||'').trim(),o1=String(r[1]||'').trim(),o2=String(r[2]||'').trim(),o3=String(r[3]||'').trim(),o4=String(r[4]||'').trim(),ans=String(r[5]||'').trim(); if(q&&o1&&o2&&ans) questions.push({question:q,option1:o1,option2:o2,option3:o3,option4:o4,answer:ans}); } window._excelParsedQuestions=questions;
            const prev=document.getElementById('excel-preview'); if(!questions.length){document.getElementById('excel-status').textContent='❌ No questions found';document.getElementById('excel-status').className='smsg er';document.getElementById('excel-status').style.display='block';prev.style.display='none';return;}
            document.getElementById('excel-preview-count').textContent=`✅ ${questions.length} questions found`; let html='<table style="width:100%;text-align:left;"><thead><tr><th>#</th><th>Question</th><th>Answer</th></tr></thead><tbody>'; questions.slice(0,10).forEach((q,i)=>{html+=`<tr><td>${i+1}</td><td>${q.question}</td><td style="color:var(--grn);">${q.answer}</td></tr>`;}); html+='</tbody></table>'; document.getElementById('excel-preview-table').innerHTML=html; prev.style.display='block';
        } catch(err) { document.getElementById('excel-status').textContent='❌ '+err.message;document.getElementById('excel-status').className='smsg er';document.getElementById('excel-status').style.display='block'; }
    }; reader.readAsArrayBuffer(file);
}

async function uploadExcelQuestions() {
    const questions=window._excelParsedQuestions||[]; const classVal=document.getElementById('mcq-class').value,subject=document.getElementById('mcq-subject').value,topic=document.getElementById('mcq-topic').value,term=document.getElementById('mcq-selected-term').value; const statusEl=document.getElementById('excel-status');
    if(!classVal||!subject||!topic||!term){statusEl.textContent='❌ வகுப்பு/பாடம்/தலைப்பு/Term தேர்வு செய்யவும்';statusEl.className='smsg er';statusEl.style.display='block';return;}
    if(!questions.length){statusEl.textContent='❌ No file selected';statusEl.className='smsg er';statusEl.style.display='block';return;}
    statusEl.textContent=`⏳ ${questions.length} saving…`;statusEl.className='smsg';statusEl.style.display='block';
    try {
        const BATCH_SIZE=400;let saved=0;
        for(let start=0;start<questions.length;start+=BATCH_SIZE){ const batch=db.batch(); questions.slice(start,start+BATCH_SIZE).forEach(q=>{const ref=db.collection('questions').doc();const data={...q,type:'mcq',class:classVal,subject,topic,term,difficulty:'medium',createdAt:new Date().toISOString()};batch.set(ref,data);lsSaveQuestion(ref.id,data);saved++;}); await batch.commit(); }
        statusEl.textContent=`✅ ${saved} saved!`;statusEl.className='smsg ok'; document.getElementById('excel-preview').style.display='none'; window._excelParsedQuestions=[]; setTimeout(()=>{statusEl.style.display='none';},4000); loadManageQuestions();
    } catch(err) { statusEl.textContent='❌ '+err.message;statusEl.className='smsg er'; }
}

function previewBulkCount() {
    const text=document.getElementById('simple-text').value.trim(); const badge=document.getElementById('bulk-count-badge');
    if(!text){badge.style.display='none';return;} const count=Math.floor(text.split('\n').map(l=>l.trim()).filter(l=>l!=='').length/6); if(count>0){badge.textContent=count+' Qs';badge.style.display='block';}else badge.style.display='none';
}

async function uploadMcqQuestions() {
    const text = document.getElementById('simple-text').value.trim(); const classVal = document.getElementById('mcq-class').value; const subject = document.getElementById('mcq-subject').value; const topic = document.getElementById('mcq-topic').value; const term = document.getElementById('mcq-selected-term').value; const statusEl = document.getElementById('mcq-status');
    if (!classVal || !subject || !topic || !term || !text) { statusEl.textContent = '❌ அனைத்து விவரங்களையும் நிரப்பவும்!'; statusEl.className = 'smsg er'; statusEl.style.display='block'; return; }
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== ''); const questions = [];
    for (let i = 0; i + 5 < lines.length; i += 6) { const q = { question: lines[i], option1: lines[i+1], option2: lines[i+2], option3: lines[i+3], option4: lines[i+4], answer: lines[i+5], type: 'mcq', class: classVal, subject: subject, topic: topic, term: term, difficulty: 'medium', createdAt: new Date().toISOString() }; if (q.question && q.option1 && q.option2 && q.answer) questions.push(q); }
    if (questions.length === 0) { statusEl.textContent = '❌ சரியான வடிவத்தில் இல்லை!'; statusEl.className = 'smsg er'; statusEl.style.display='block'; return; }
    statusEl.textContent = `⏳ ${questions.length} கேள்விகள் சேமிக்கப்படுகின்றன...`; statusEl.className = 'smsg'; statusEl.style.display='block';
    try {
        const BATCH_SIZE = 400; let saved = 0;
        for (let start = 0; start < questions.length; start += BATCH_SIZE) { const batch = db.batch(); const chunk = questions.slice(start, start + BATCH_SIZE); chunk.forEach(q => { const ref = db.collection('questions').doc(); batch.set(ref, q); lsSaveQuestion(ref.id, q); saved++; }); await batch.commit(); }
        statusEl.textContent = `✅ ${saved} கேள்விகள் சேமிக்கப்பட்டன!`; statusEl.className = 'smsg ok'; document.getElementById('simple-text').value = ''; setTimeout(() => { statusEl.style.display = 'none'; }, 4000); loadManageQuestions();
    } catch (error) { statusEl.textContent = '❌ பிழை: ' + error.message; statusEl.className = 'smsg er'; }
}

function updateSingleAnswerSelect() {
    const opts = ['single-opt1', 'single-opt2', 'single-opt3', 'single-opt4'].map(id => document.getElementById(id).value.trim());
    const sel = document.getElementById('single-answer'); const prev = sel.value;
    sel.innerHTML = '<option value="">✅ சரியான விடை தேர்வு</option>';
    opts.forEach((opt, i) => { if (opt) { const o = document.createElement('option'); o.value = opt; o.textContent = ['A','B','C','D'][i] + '. ' + opt; sel.appendChild(o); } });
    if (prev && opts.includes(prev)) sel.value = prev;
}

async function uploadSingleMcq() {
    const question = document.getElementById('single-question').value.trim(); const opt1 = document.getElementById('single-opt1').value.trim(); const opt2 = document.getElementById('single-opt2').value.trim(); const opt3 = document.getElementById('single-opt3').value.trim(); const opt4 = document.getElementById('single-opt4').value.trim(); const answer = document.getElementById('single-answer').value.trim();
    const classVal = document.getElementById('mcq-class').value; const subject = document.getElementById('mcq-subject').value; const topic = document.getElementById('mcq-topic').value; const term = document.getElementById('mcq-selected-term').value; const statusEl = document.getElementById('single-mcq-status');
    if (!classVal || !subject || !topic || !term || !question || !opt1 || !opt2 || !answer) { statusEl.textContent = '❌ அனைத்து விவரங்களையும் நிரப்பவும்!'; statusEl.className = 'smsg er'; statusEl.style.display='block'; return; }
    const qData = { question, option1: opt1, option2: opt2, option3: opt3, option4: opt4, answer, type: 'mcq', class: classVal, subject, topic, term, difficulty: 'medium', createdAt: new Date().toISOString() };
    try { const ref = await db.collection('questions').add(qData); lsSaveQuestion(ref.id, qData); statusEl.textContent = '✅ சேர்க்கப்பட்டது!'; statusEl.className = 'smsg ok'; statusEl.style.display='block'; ['single-question','single-opt1','single-opt2','single-opt3','single-opt4'].forEach(id => document.getElementById(id).value = ''); updateSingleAnswerSelect(); setTimeout(() => { statusEl.style.display = 'none'; }, 3000); loadManageQuestions(); } catch (error) { statusEl.textContent = '❌ ' + error.message; statusEl.className = 'smsg er'; statusEl.style.display='block'; }
}

async function uploadDescQuestion() {
    const question = document.getElementById('desc-question').value.trim(); const answer = document.getElementById('desc-answer').value.trim();
    const classVal = document.getElementById('desc-class').value; const subject = document.getElementById('desc-subject').value; const topic = document.getElementById('desc-topic').value; const term = document.getElementById('desc-selected-term').value; const statusEl = document.getElementById('desc-status');
    if (!classVal || !subject || !topic || !term || !question || !answer) { statusEl.textContent = '❌ அனைத்து விவரங்களையும் நிரப்பவும்!'; statusEl.className = 'smsg er'; statusEl.style.display='block'; return; }
    const qData = { question, answer, type: 'desc', class: classVal, subject, topic, term, difficulty: 'medium', createdAt: new Date().toISOString() };
    try { const ref = await db.collection('questions').add(qData); lsSaveQuestion(ref.id, qData); statusEl.textContent = '✅ சேர்க்கப்பட்டது!'; statusEl.className = 'smsg ok'; statusEl.style.display='block'; document.getElementById('desc-question').value = ''; document.getElementById('desc-answer').value = ''; setTimeout(() => { statusEl.style.display = 'none'; }, 3000); loadManageQuestions(); } catch (error) { statusEl.textContent = '❌ ' + error.message; statusEl.className = 'smsg er'; statusEl.style.display='block'; }
}

// ==================== MANAGE QUESTIONS & EXPLICIT EDIT/DELETE ====================
// Explicitly building the question cards with Edit/Delete buttons inside the card
const _buildQ = (q, idx, type) => {
    const termLabel = t => t === 'term1' ? 'Term 1' : t === 'term2' ? 'Term 2' : t === 'term3' ? 'Term 3' : t || '-';
    const lsBadge = q._fromLS ? '<span style="background:rgba(245,158,11,.15);color:var(--org);font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;">Local</span>' : '';
    const typeBg = type === 'mcq' ? 'var(--ind)' : 'var(--grn)';
    const typeLabel = type === 'mcq' ? 'MCQ' : 'DESC';
    let inner = '';
    
    if (type === 'mcq') {
        const opts = [q.option1, q.option2, q.option3, q.option4].map((o, oi) => {
            if (!o) return ''; const correct = o === q.answer; const letterBg = correct ? 'var(--grn)' : 'var(--bg)';
            return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-radius:12px;background:${correct ? 'var(--grn-lt)' : 'var(--bg)'};border:1px solid ${correct ? 'rgba(16,185,129,.2)' : 'transparent'};margin-bottom:6px;"><span style="width:22px;height:22px;border-radius:6px;background:${letterBg};color:${correct ? '#fff' : 'var(--text2)'};font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${['A', 'B', 'C', 'D'][oi]}</span><span style="font-size:14px;font-weight:${correct ? '700' : '500'};color:${correct ? 'var(--grn)' : 'var(--text)'};flex:1;">${escapeHtml(o)}</span></div>`;
        }).join('');
        inner = `<div style="margin-bottom:12px;">${opts}</div>`;
    } else {
        inner = `<div style="background:var(--grn-lt);border-radius:var(--r3);padding:14px;margin-bottom:14px;font-size:14px;color:var(--grn);font-weight:600;line-height:1.6;">${escapeHtml(q.answer || '')}</div>`;
    }
    
    // Explicit Action Buttons Added Here!
    const actionBtns = `
        <div style="display:flex; gap:12px; margin-top:14px; padding-top:14px; border-top:1px dashed var(--border);">
            <button onclick="editQuestion('${q.id}', '${type}')" style="flex:1; padding:12px; border-radius:12px; background:var(--blu-lt); color:var(--blu); border:none; font-weight:800; font-size:13px; cursor:pointer; transition:transform 0.15s;">✏️ திருத்து</button>
            <button onclick="deleteQuestion('${q.id}')" style="flex:1; padding:12px; border-radius:12px; background:var(--red-lt); color:var(--red); border:none; font-weight:800; font-size:13px; cursor:pointer; transition:transform 0.15s;">🗑 நீக்கு</button>
        </div>
    `;

    return `<div class="scard" data-id="${q.id}" data-type="${type}" data-name="${escapeAttr(q.question || '')}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:8px;"><span style="background:${typeBg};color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;">${typeLabel}</span><span style="font-size:12px;font-weight:700;color:var(--text3);">#${idx + 1}</span>${lsBadge}</div>
          <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:11px;font-weight:700;color:var(--text2);background:var(--bg);padding:4px 12px;border-radius:20px;">${termLabel(q.term)}</span><span style="font-size:11px;font-weight:700;color:var(--text2);background:var(--bg);padding:4px 12px;border-radius:20px;">${escapeHtml(q.topic || '')}</span></div>
        </div>
        <div style="font-size:16px;font-weight:800;color:var(--text);line-height:1.5;margin-bottom:14px;">${escapeHtml(q.question || '')}</div>
        ${inner}
        ${actionBtns}
    </div>`;
};

async function loadManageQuestions() {
    const classVal = document.getElementById('manage-class').value; const subject = document.getElementById('manage-subject').value;
    const term = window.manageFilterTerm || 'all'; const type = window.manageFilterType || 'mcq';
    const topicSel = document.getElementById('manage-topic'); const selTopic = topicSel ? topicSel.value : 'all';
    const listEl = document.getElementById('manage-questions-list'); const noDataEl = document.getElementById('manage-no-data');

    if (!classVal || !subject) { if (listEl) listEl.innerHTML = ''; if (noDataEl) noDataEl.style.display = 'block'; return; }
    if (listEl) listEl.innerHTML = '<div class="loading"><div class="ldots"><span class="ldot"></span><span class="ldot"></span><span class="ldot"></span></div></div>';
    if (noDataEl) noDataEl.style.display = 'none';

    try {
        let query = db.collection('questions').where('class', '==', classVal).where('subject', '==', subject).where('type', '==', type);
        const snapshot = await query.get(); let questions = []; snapshot.forEach(doc => questions.push({ id: doc.id, ...doc.data() }));
        Object.entries(lsGetQuestions()).forEach(([id, q]) => { if (q.class === classVal && q.subject === subject && q.type === type && !questions.find(fq => fq.id === id)) questions.push({ id, ...q, _fromLS: true }); });
        
        if (term !== 'all') questions = questions.filter(q => q.term === term);
        if (selTopic && selTopic !== 'all') questions = questions.filter(q => q.topic === selTopic);
        
        const topicSet = new Set(questions.map(q => q.topic).filter(Boolean));
        if (topicSel) {
            const prev = topicSel.value; topicSel.innerHTML = '<option value="all">All Topics</option>'; Array.from(topicSet).sort().forEach(t => topicSel.innerHTML += `<option value="${t}">${t}</option>`);
            if (prev && topicSet.has(prev)) topicSel.value = prev;
        }
        
        if (!questions.length) { if (listEl) listEl.innerHTML = ''; if (noDataEl) noDataEl.style.display = 'block'; return; }
        
        questions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const countEl = document.getElementById('manage-card-count'); if (countEl) countEl.textContent = questions.length + ' Qs';
        if (listEl) listEl.innerHTML = questions.map((q, i) => _buildQ(q, i, type)).join('');
    } catch (err) { if (listEl) listEl.innerHTML = ''; if (noDataEl) { noDataEl.style.display = 'block'; noDataEl.innerHTML = `<div class="empty-icon">⚠️</div><div class="empty-text">${err.message}</div>`; } }
}

function filterManageByTerm(term) { window.manageFilterTerm = term; document.querySelectorAll('#panel-manage .pill').forEach(p => { const oc = p.getAttribute('onclick') || ''; if (oc.includes('filterManageByTerm')) p.classList.toggle('on', oc.includes("'" + term + "'")); }); loadManageQuestions(); }
function filterManageByType(type) { window.manageFilterType = type; document.querySelectorAll('#panel-manage .pill').forEach(p => { const oc = p.getAttribute('onclick') || ''; if (oc.includes('filterManageByType')) p.classList.toggle('on', oc.includes("'" + type + "'")); }); loadManageQuestions(); }
function filterManageList() { const term = document.getElementById('manage-search').value.toLowerCase(); document.querySelectorAll('#manage-questions-list .scard').forEach(card => card.style.display = card.textContent.toLowerCase().includes(term) ? 'block' : 'none'); }

async function deleteQuestion(id) { 
    popupConfirm('கேள்வி நீக்கு', 'இந்த கேள்வியை நிரந்தரமாக நீக்க வேண்டுமா?', async function() { 
        try { 
            await db.collection('questions').doc(id).delete(); 
            lsDeleteQuestion(id); 
            loadManageQuestions(); 
            showPopup({ icon:'✅', title:'நீக்கப்பட்டது', msg:'கேள்வி அழிக்கப்பட்டது.', type:'alert'}); 
        } catch (error) { 
            lsDeleteQuestion(id); 
            loadManageQuestions(); 
            popupError('Firebase பிழை: ' + error.message); 
        } 
    }); 
}

async function editQuestion(id, type) {
    try {
        const doc = await db.collection('questions').doc(id).get(); 
        const q = doc.exists ? doc.data() : lsGetQuestions()[id];
        if (!q) { popupError('கேள்வி கிடைக்கவில்லை!'); return; }
        
        const isMcq = (type === 'mcq' || q.type === 'mcq');

        let optionsHtml = '';
        if (isMcq) {
            optionsHtml = `<label class="flbl" style="margin-top:16px;">Options</label><div class="fl2">
                <input type="text" id="edit-opt1" class="finp" value="${escapeAttr(q.option1||'')}" placeholder="Option A" oninput="updateEditAnswerSelect()">
                <input type="text" id="edit-opt2" class="finp" value="${escapeAttr(q.option2||'')}" placeholder="Option B" oninput="updateEditAnswerSelect()">
                <input type="text" id="edit-opt3" class="finp" value="${escapeAttr(q.option3||'')}" placeholder="Option C" oninput="updateEditAnswerSelect()">
                <input type="text" id="edit-opt4" class="finp" value="${escapeAttr(q.option4||'')}" placeholder="Option D" oninput="updateEditAnswerSelect()">
            </div>
            <label class="flbl" style="margin-top:16px;">Correct Answer</label><select id="edit-answer" class="fsel">${[q.option1,q.option2,q.option3,q.option4].filter(Boolean).map(o=>`<option value="${escapeAttr(o)}" ${q.answer===o?'selected':''}>${escapeHtml(o)}</option>`).join('')}</select>`;
        } else { optionsHtml = `<label class="flbl" style="margin-top:16px;">Answer</label><textarea id="edit-answer" class="ftxt" rows="4">${escapeHtml(q.answer||'')}</textarea>`; }

        const modalHtml = `<div id="edit-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)document.getElementById('edit-modal-overlay').remove()">
        <div style="background:var(--white);border-radius:24px;width:100%;max-width:400px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.3);border:1px solid var(--border);">
            <div style="background:var(--ind);padding:18px 24px;color:white;font-weight:800;font-size:16px;display:flex;justify-content:space-between;align-items:center;"><span>✏️ கேள்வி திருத்தம்</span><div style="background:rgba(255,255,255,0.2);width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="document.getElementById('edit-modal-overlay').remove()">✕</div></div>
            <div style="padding:24px;"><label class="flbl">Question</label><textarea id="edit-question" class="ftxt" rows="3">${escapeHtml(q.question||'')}</textarea>${optionsHtml}
                <div style="display:flex;gap:12px;margin-top:24px;">
                    <button onclick="document.getElementById('edit-modal-overlay').remove()" style="flex:1;padding:14px;border-radius:14px;border:none;background:var(--bg);color:var(--text);font-weight:800;cursor:pointer;font-family:inherit;">ரத்து</button>
                    <button onclick="saveEditQuestion('${id}','${isMcq?'mcq':'desc'}')" style="flex:1;padding:14px;border-radius:14px;border:none;background:var(--ind);color:white;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 15px var(--ind-lt);">சேமி</button>
                </div><div id="edit-status" class="smsg"></div>
            </div></div></div>`;
        const existing = document.getElementById('edit-modal-overlay'); if (existing) existing.remove(); document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch(e) { popupError('பிழை: ' + e.message); }
}

function updateEditAnswerSelect() { const sel = document.getElementById('edit-answer'); if (!sel) return; const opts = ['edit-opt1','edit-opt2','edit-opt3','edit-opt4'].map(id => document.getElementById(id)?document.getElementById(id).value.trim():'').filter(Boolean); const prev = sel.value; sel.innerHTML = opts.map(o => `<option value="${escapeAttr(o)}" ${prev===o?'selected':''}>${escapeHtml(o)}</option>`).join(''); }
async function saveEditQuestion(id, type) {
    const question = document.getElementById('edit-question').value.trim(); const answer = document.getElementById('edit-answer').value.trim(); const statusEl = document.getElementById('edit-status'); const updateData = { question, answer };
    if (type === 'mcq') { updateData.option1 = document.getElementById('edit-opt1').value.trim(); updateData.option2 = document.getElementById('edit-opt2').value.trim(); updateData.option3 = document.getElementById('edit-opt3').value.trim(); updateData.option4 = document.getElementById('edit-opt4').value.trim(); }
    try { statusEl.textContent = '⏳ சேமிக்கப்படுகிறது...'; statusEl.className = 'smsg'; statusEl.style.display = 'block'; await db.collection('questions').doc(id).update(updateData); statusEl.textContent = '✅ திருத்தப்பட்டது!'; statusEl.className = 'smsg ok'; setTimeout(() => { document.getElementById('edit-modal-overlay').remove(); loadManageQuestions(); }, 1000); } catch(e) { statusEl.textContent = '❌ பிழை: ' + e.message; statusEl.className = 'smsg er'; }
}

// ==================== SCORES & ANALYTICS ====================
async function getAllScores() {
    let all = [];
    try { const snap = await db.collection('scores').get(); snap.forEach(d => all.push({ _src: 'fb', id: d.id, ...d.data() })); } catch(e) {}
    lsGetScores().forEach(s => { if (!all.find(a => a.name === s.name && a.class === s.class && a.subject === s.subject && a.createdAt === s.createdAt)) all.push({ _src: 'ls', ...s }); });
    all = all.map(s => { s.name = s.name || 'பெயர் இல்லை'; s.class = s.class || '-'; s.subject = s.subject || '-'; return s; });
    return all;
}

async function loadAnalytics() {
    const cls = document.getElementById('ana-class-filter').value; const subj = document.getElementById('ana-subject-filter').value;
    document.getElementById('ana-empty').style.display = 'none'; document.getElementById('ana-loading').style.display = 'block';
    
    let allScores = await getAllScores();
    if (cls) allScores = allScores.filter(s => (s.class || '') === cls); if (subj) allScores = allScores.filter(s => (s.subject || '') === subj);
    
    document.getElementById('ana-loading').style.display = 'none';
    if (!allScores.length) { ['ana-summary-cards', 'ana-score-dist', 'ana-subject-bars', 'ana-top-list'].forEach(id => document.getElementById(id).innerHTML = ''); document.getElementById('ana-empty').style.display = 'block'; return; }

    const tAtt = allScores.length, uSt = new Set(allScores.map(s => s.name || '?')).size; const aPct = Math.round(allScores.reduce((a, s) => a + getPct(s), 0) / tAtt);
    document.getElementById('ana-summary-cards').innerHTML = `<div class="ana-stat"><div class="ana-num" style="color:var(--blu);">${uSt}</div><div class="ana-lbl">மாணவர்கள்</div></div><div class="ana-stat"><div class="ana-num" style="color:var(--org);">${tAtt}</div><div class="ana-lbl">முயற்சிகள்</div></div><div class="ana-stat"><div class="ana-num" style="color:var(--grn);">${aPct}%</div><div class="ana-lbl">சராசரி</div></div>`;
         
    let distHtml = '<div class="form-card" style="margin-bottom:16px;"><div class="fc-head">📊 Score Distribution</div><div class="fc-body">';
    [{l:'90–100%',min:90,max:100,c:'var(--grn)'},{l:'75–89%',min:75,max:89,c:'var(--blu)'},{l:'50–74%',min:50,max:74,c:'var(--org)'},{l:'0–49%',min:0,max:49,c:'var(--red)'}].forEach(r => { const c = allScores.filter(s => { const p = getPct(s); return p >= r.min && p <= r.max; }).length; const p = tAtt > 0 ? Math.round((c / tAtt) * 100) : 0; distHtml += `<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;font-weight:700;color:var(--text);">${r.l}</span><span style="font-size:13px;font-weight:800;color:${r.c};">${c} (${p}%)</span></div><div style="background:var(--bg);border-radius:20px;height:10px;"><div style="background:${r.c};width:${p}%;height:100%;border-radius:20px;transition:width .5s;"></div></div></div>`; });
    document.getElementById('ana-score-dist').innerHTML = distHtml + '</div></div>';

    const subMap = {}; allScores.forEach(s => { const su = s.subject || 'பிற'; if (!subMap[su]) subMap[su] = { c: 0, s: 0 }; subMap[su].c++; subMap[su].s += getPct(s); });
    let sbHtml = '<div class="form-card" style="margin-bottom:16px;"><div class="fc-head">📚 Subject Avg</div><div class="fc-body">';
    Object.entries(subMap).sort((a, b) => (b[1].s / b[1].c) - (a[1].s / a[1].c)).forEach(([su, d]) => { const avg = Math.round(d.s / d.c); const col = subjectThemes[su] ? subjectThemes[su].border : 'var(--ind)'; sbHtml += `<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="font-size:13px;font-weight:700;color:var(--text);">${su}</span><span style="font-size:14px;font-weight:900;color:${col};">${avg}%</span></div><div style="background:var(--bg);border-radius:20px;height:10px;"><div style="background:${col};width:${avg}%;height:100%;border-radius:20px;"></div></div></div>`; });
    document.getElementById('ana-subject-bars').innerHTML = sbHtml + '</div></div>';

    const sB = {}; allScores.forEach(s => { const nm = s.name || '?'; const p = getPct(s); if (!sB[nm] || p > sB[nm].p) sB[nm] = { p, cls: s.class, att: 0, tP: 0 }; sB[nm].att++; sB[nm].tP += p; });
    const top = Object.entries(sB).sort((a, b) => b[1].p - a[1].p).slice(0, 5);
    let topHtml = '<div class="form-card"><div class="fc-head">🏆 Top 5</div><div class="fc-body" style="padding-top:10px;">';
    top.forEach(([nm, d], i) => { topHtml += `<div class="scard" style="cursor:default;margin-bottom:10px;padding:14px;"><div style="display:flex;align-items:center;gap:12px;"><span style="font-size:1.8rem;">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span><div style="flex:1;"><div style="font-weight:800;font-size:15px;color:var(--text);">${nm}</div><div style="font-size:12px;font-weight:600;color:var(--text2);margin-top:2px;">${d.cls || '-'} · ${d.att} tries</div></div><span class="pct-badge pct-grn">${d.p}%</span></div></div>`; });
    document.getElementById('ana-top-list').innerHTML = topHtml + '</div></div>';
}

async function loadScores() {
    const cls = document.getElementById('score-class-filter').value; const subj = document.getElementById('score-subject-filter').value; const listEl = document.getElementById('scores-list');
    listEl.innerHTML = '<div class="loading"><div class="ldots"><span class="ldot"></span><span class="ldot"></span><span class="ldot"></span></div></div>';
    
    let allScores = await getAllScores();
    if (cls) allScores = allScores.filter(s => (s.class || '') === cls); if (subj) allScores = allScores.filter(s => (s.subject || '') === subj);
    
    if (!allScores.length) { listEl.innerHTML = '<div class="empty-card"><div class="empty-icon" style="font-size:3rem;">📭</div><div class="empty-text" style="font-weight:700;">மதிப்பெண் பதிவுகள் இல்லை</div></div>'; return; }
    
    allScores.sort((a, b) => { const gt = s => { try { if (!s.createdAt) return 0; if (typeof s.createdAt === 'string') return new Date(s.createdAt).getTime(); if (s.createdAt.seconds) return s.createdAt.seconds * 1000; return 0; } catch (e) { return 0; } }; return gt(b) - gt(a); });
    const isAdmin = window.currentTeacher && window.currentTeacher.username === 'admin';
    
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:0 4px;"><div class="count-badge">🏅 ${allScores.length} பதிவுகள்</div>${isAdmin ? `<button onclick="deleteAllScores()" style="padding:8px 16px;border-radius:20px;background:var(--red-lt);color:var(--red);border:none;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">🗑 அனைத்தும் நீக்கு</button>` : ''}</div>`;
    
    allScores.forEach((s, i) => {
        const pct = getPct(s); const pctCls = pct >= 80 ? 'pct-grn' : pct >= 50 ? 'pct-org' : 'pct-red';
        const safeName = String(s.name).replace(/</g, "&lt;").replace(/>/g, "&gt;"); const safeClass = String(s.class).replace(/</g, "&lt;").replace(/>/g, "&gt;"); const safeSubj = String(s.subject).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        let dateStr = s.date || '-', timeStr = '';
        if (s.createdAt) { let d = (typeof s.createdAt === 'string') ? new Date(s.createdAt) : ((s.createdAt.toDate) ? s.createdAt.toDate() : new Date(s.createdAt.seconds * 1000)); if (d && !isNaN(d.getTime())) { const dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'), yy = String(d.getFullYear()).slice(-2); dateStr = `${dd}/${mm}/${yy}`; let hh = d.getHours(), mn = String(d.getMinutes()).padStart(2, '0'), ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12; timeStr = `${hh}:${mn} ${ap}`; } }
        
        const certData = encodeURIComponent(JSON.stringify({ name: s.name, class: s.class, subject: s.subject, correct: s.correct || 0, total: s.total || 0, pct, date: dateStr }));
        
        html += `<div class="scard score-row" style="cursor:default;padding:18px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="width:34px;height:34px;border-radius:12px;background:var(--blu-lt);color:var(--blu);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;">${i + 1}</span>
                    <div><div class="sc-q s-name" style="margin:0;font-size:15px;font-weight:800;">${safeName}</div><div style="font-size:12px;color:var(--text2);font-weight:600;margin-top:2px;">${safeClass} · ${safeSubj}</div></div>
                </div>
                <span class="pct-badge ${pctCls}" style="font-size:14px;">${pct}%</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px dashed var(--border);">
                <div><div style="font-size:15px;font-weight:800;color:var(--text);">${s.correct || 0} / ${s.total || 0}</div><div style="font-size:12px;font-weight:600;color:var(--text3);margin-top:4px;">${dateStr} · ${timeStr}</div></div>
                ${isAdmin ? `<div style="display:flex;gap:8px;">
                    <button onclick="adminGenerateCertificate('${certData}')" style="padding:10px 16px;border-radius:12px;background:var(--grn-lt);color:var(--grn);border:none;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">🎓 Print</button>
                    <button onclick="adminDeleteScore('${s.id || ''}','${safeName}')" style="padding:10px 16px;border-radius:12px;background:var(--red-lt);color:var(--red);border:none;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">🗑</button>
                </div>` : ''}
            </div></div>`;
    });
    listEl.innerHTML = html;
}

function filterScoreList() { const term = document.getElementById('score-search').value.toLowerCase(); document.querySelectorAll('#scores-list .score-row').forEach(card => card.style.display = card.textContent.toLowerCase().includes(term) ? 'block' : 'none'); }

async function adminDeleteScore(id, name) { if(!id) { popupError('அனைத்தும் நீக்கு பட்டனைப் பயன்படுத்தவும்.'); return; } popupConfirm('பதிவை நீக்கு', `${name}-ன் இந்த மார்க் பதிவை நீக்க வேண்டுமா?`, async function() { try { await db.collection('scores').doc(id).delete(); showPopup({ icon:'✅', title:'நீக்கப்பட்டது!', msg: 'பதிவு நீக்கப்பட்டது.', type:'alert', onConfirm: loadScores }); } catch(e) { popupError('பிழை: ' + e.message); } }); }
async function deleteAllScores() { popupDanger('⚠️ அனைத்தும் நீக்கு', 'Table-ல் உள்ள அனைத்து மார்க் தரவும் நீக்கப்படும்!', async function() { const snap = await db.collection('scores').get(); if (!snap.empty) { const batch = db.batch(); snap.forEach(d => batch.delete(d.ref)); await batch.commit(); } lsSet(LS_SCORES, []); showPopup({ icon:'✅', title:'நீக்கப்பட்டது!', msg:'அனைத்து மார்க் பட்டியலும் அழிக்கப்பட்டது.', type:'alert', onConfirm: loadScores }); }); }
async function adminDeleteAllStudentScores() { popupDanger('⚠️ அனைத்தும் நீக்கு','அனைத்து மாணவர் மார்க் நீக்கப்படும்!', async function() { try { const snap = await db.collection('scores').get(); if(!snap.empty){ const batch=db.batch(); snap.forEach(d=>batch.delete(d.ref)); await batch.commit(); } lsSet(LS_SCORES,[]); showPopup({icon:'✅',title:'நீக்கப்பட்டது!',msg:'அனைத்தும் அழிக்கப்பட்டது.',type:'alert',onConfirm:()=>{switchTab('dash');loadAdminDashboard();}}); } catch(e){popupError('பிழை: '+e.message);} },'🗑 நீக்கு'); }

function adminGenerateCertificate(enc){
    const d=JSON.parse(decodeURIComponent(enc));
    document.getElementById('cert-name').textContent=d.name;
    document.getElementById('cert-class').textContent=d.class&&d.class!=='-'?d.class+' ஆம் வகுப்பு':'';
    document.getElementById('cert-subject').textContent=d.subject;
    document.getElementById('cert-score').textContent=(d.correct||0)+' / '+(d.total||0);
    document.getElementById('cert-pct').textContent=d.pct+'%';
    document.getElementById('cert-date').textContent=d.date||new Date().toLocaleDateString('ta-IN');
    let g,gc,gb,gbr;
    if(d.pct>=90){g='🥇 A+ சிறந்த திறன்';gc='#047857';gb='var(--grn-lt)';gbr='#10b981';}
    else if(d.pct>=75){g='🥈 A நல்ல திறன்';gc='#1d4ed8';gb='var(--blu-lt)';gbr='#3b82f6';}
    else if(d.pct>=50){g='🥉 B சராசரி திறன்';gc='#b45309';gb='var(--org-lt)';gbr='#f59e0b';}
    else{g='📚 மேலும் பயிற்சி தேவை';gc='#be123c';gb='var(--red-lt)';gbr='#e11d48';}
    const gb2=document.getElementById('cert-grade-box');
    gb2.style.background=gb;gb2.style.border='2px solid '+gbr;
    gb2.innerHTML='<div style="font-size:16px;font-weight:900;color:'+gc+';">'+g+'</div>';
    openSheet('cert-sheet');
}

function printCertificate() { const certBox = document.getElementById('cert-box'); const w = window.open('', '_blank', 'width=600,height=800'); w.document.write('<html><head><meta charset="UTF-8"><title>Certificate</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet"><style>body{font-family:Inter,sans-serif;margin:20px;background:#fff;} @media print{body{margin:0;}}</style></head><body>' + certBox.outerHTML + '<script>window.onload=function(){window.print();}<\/script></body></html>'); w.document.close(); }

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    applyDarkMode();
    applyFontSize();
    initTopics();
    
    // Auto banner login check
    const u = localStorage.getItem('ua_last_teacher_user') || '';
    const b = document.getElementById('auto-banner');
    if (u && teacherLogins[u] && b) { 
        document.getElementById('auto-name').textContent = teacherLogins[u].name; b.classList.add('show'); 
        if(u === 'admin') document.getElementById('admin-danger-section').style.display = 'flex';
    }
    
    const classes = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    ['mcq-class', 'desc-class', 'manage-class', 'ana-class-filter', 'score-class-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.innerHTML.includes('option')) { 
            el.innerHTML = '<option value="">வகுப்பு தேர்வு</option>'; 
            classes.forEach(c => el.innerHTML += `<option value="${c}">${c} ஆம் வகுப்பு</option>`); 
        }
    });

    document.getElementById('mcq-class').addEventListener('change', () => { updateAdminSubjects('mcq-class', 'mcq-subject'); loadMcqTopics(); });
    document.getElementById('desc-class').addEventListener('change', () => { updateAdminSubjects('desc-class', 'desc-subject'); loadDescTopics(); });
    document.getElementById('manage-class').addEventListener('change', () => { updateAdminSubjects('manage-class', 'manage-subject', true); loadManageQuestions(); });
    document.getElementById('ana-class-filter').addEventListener('change', () => { updateAdminSubjects('ana-class-filter', 'ana-subject-filter', true); loadAnalytics(); });
    document.getElementById('score-class-filter').addEventListener('change', () => { updateAdminSubjects('score-class-filter', 'score-subject-filter', true); loadScores(); });

    updateAdminSubjects('mcq-class', 'mcq-subject');
    updateAdminSubjects('desc-class', 'desc-subject');
    updateAdminSubjects('manage-class', 'manage-subject', true);
    updateAdminSubjects('ana-class-filter', 'ana-subject-filter', true);
    updateAdminSubjects('score-class-filter', 'score-subject-filter', true);
    
    document.getElementById('mcq-subject').addEventListener('change', loadMcqTopics);
    document.getElementById('desc-subject').addEventListener('change', loadDescTopics);
    document.getElementById('manage-subject').addEventListener('change', loadManageQuestions);
    document.getElementById('manage-topic').addEventListener('change', loadManageQuestions);
    
    updateSingleAnswerSelect();
    selectMcqTerm('term1');
    selectDescTerm('term1');
    filterManageByTerm('all');
    filterManageByType('mcq');
    switchMcqTab('excel');
});


