const firebaseConfig = {
    apiKey: "AIzaSyCUeWw384CaVwHqnwfFJ8n-JpudiVbENCg",
    authDomain: "students-quiz-5a367.firebaseapp.com",
    projectId: "students-quiz-5a367",
    storageBucket: "students-quiz-5a367.firebasestorage.app",
    messagingSenderId: "969090839069",
    appId: "1:969090839069:web:8619a9b3461ebcf6c30cf4"
};

let db;
if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
    db = firebase.firestore();
}

const TEACHERS_DATA = {
    "tamil":   { password: "123",   name: "தமிழ் ஆசிரியர்",        subject: "தமிழ்",            classes: ["1","2","3","4","5","6","7","8","9","10","11","12"] },
    "english": { password: "123",   name: "ஆங்கில ஆசிரியர்",       subject: "ஆங்கிலம்",         classes: ["1","2","3","4","5","6","7","8","9","10","11","12"] },
    "maths":   { password: "123",   name: "கணித ஆசிரியர்",         subject: "கணிதம்",           classes: ["1","2","3","4","5","6","7","8","9","10","11","12"] },
    "science": { password: "123",   name: "அறிவியல் ஆசிரியர்",     subject: "அறிவியல்",         classes: ["1","2","3","4","5","6","7","8","9","10","11","12"] },
    "social":  { password: "123",   name: "சமூக அறிவியல் ஆசிரியர்", subject: "சமூக அறிவியல்",   classes: ["1","2","3","4","5","6","7","8","9","10","11","12"] },
    "admin":   { password: "admin", name: "தலைமை ஆசிரியர்",        subject: "அனைத்தும்",        classes: ["1","2","3","4","5","6","7","8","9","10","11","12"] }
};

let loggedInTeacher = null, loggedInStudent = "", loggedInClass = "";
let currentActiveSubject = "", activeQuizType = "mcq";
let currentQuestions = [], currentQuestionIndex = 0;
let score = 0, wrongCount = 0, missedCount = 0, timerInterval, timeLeft = 30;
let userAnswersLog = [], itemToDelete = null;

// --- Sound Setup ---
let soundEnabled = true;
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function toggleSound() {
    soundEnabled = !soundEnabled;
    document.getElementById('sound-toggle').innerText = soundEnabled ? '🔊' : '🔇';
}

function playSound(type) {
    if (!soundEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    if (type === 'correct') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime); gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 0.3);
    }
}
// -------------------

document.addEventListener("DOMContentLoaded", () => {
    let savedName = localStorage.getItem("quiz_student_name");
    let savedClass = localStorage.getItem("quiz_student_class");
    if (savedName && savedClass) {
        loggedInStudent = savedName; 
        loggedInClass = savedClass;
        document.getElementById('welcome-text').innerText = "வணக்கம், " + loggedInStudent + " (" + loggedInClass + " வகுப்பு) 👋";
        showScreen('subject-screen');
    }
    // ── PWA: Service Worker ──────────────────────────────────────
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('[SW] Registered:', reg.scope);
                reg.addEventListener('updatefound', () => {
                    const nw = reg.installing;
                    nw.addEventListener('statechange', () => {
                        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                            const t = document.getElementById('xp-toast');
                            if (t) {
                                t.textContent = '🔄 Update ready! Click to refresh';
                                t.style.display = 'block';
                                t.style.background = '#10b981';
                                t.style.cursor = 'pointer';
                                t.onclick = () => { nw.postMessage({ type:'SKIP_WAITING' }); window.location.reload(); };
                            }
                        }
                    });
                });
            })
            .catch(e => console.warn('[SW] Error:', e));
    }

    // ── PWA: Install Prompt ──────────────────────────────────────
    let _deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        _deferredPrompt = e;
        // Show install button on home screen
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'flex';
        console.log('[PWA] Install prompt ready');
    });

    window.installPWA = async function() {
        const btn = document.getElementById('pwa-install-btn');
        if (!_deferredPrompt) {
            // Fallback: show manual instructions
            const msg = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
                ? '📱 iOS: Safari → Share button → "Add to Home Screen" tap செய்யவும்'
                : '📱 Chrome: Menu (⋮) → "Add to Home screen" அல்லது "Install app" tap செய்யவும்';
            alert(msg);
            return;
        }
        _deferredPrompt.prompt();
        const { outcome } = await _deferredPrompt.userChoice;
        console.log('[PWA] Install outcome:', outcome);
        _deferredPrompt = null;
        if (btn) btn.style.display = 'none';
        if (outcome === 'accepted') {
            const t = document.getElementById('xp-toast');
            if (t) {
                t.textContent = '🎉 App install ஆகிறது!';
                t.style.display = 'block';
                t.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
                setTimeout(() => { t.style.display = 'none'; }, 3000);
            }
        }
    };

    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installed!');
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'none';
    });
});

function showScreen(screenId) {
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function goHome() {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById('pwd-error').classList.add('hidden');
    document.getElementById('student-error').classList.add('hidden');
    showScreen('role-screen');
}

function checkAdminLogin() {
    if (loggedInTeacher) { setupAdminUI(); showScreen('admin-screen'); switchAdminTab('dashboard'); }
    else { showScreen('admin-login-screen'); }
}

function verifyTeacherLogin() {
    const user = document.getElementById('teacher-username').value.trim().toLowerCase();
    const pass = document.getElementById('admin-password').value.trim();
    const errorMsg = document.getElementById('pwd-error');
    if (TEACHERS_DATA[user] && TEACHERS_DATA[user].password === pass) {
        loggedInTeacher = TEACHERS_DATA[user];
        errorMsg.classList.add('hidden');
        document.getElementById('teacher-username').value = '';
        document.getElementById('admin-password').value = '';
        setupAdminUI();
        showScreen('admin-screen'); switchAdminTab('mcq');
    } else {
        errorMsg.innerText = "தவறான பயனர்பெயர் அல்லது கடவுச்சொல்! ❌";
        errorMsg.classList.remove('hidden');
    }
}

function adminLogout() { loggedInTeacher = null; goHome(); }

function setupAdminUI() {
    document.getElementById('admin-welcome-text').innerHTML = `⚙️ ஆசிரியர் பக்கம் <br><span style="font-size:14px; color:#475569;">${loggedInTeacher.name}</span>`;
    let subjectHtml = loggedInTeacher.subject === "அனைத்தும்" 
        ? `<option value="தமிழ்">தமிழ்</option><option value="ஆங்கிலம்">ஆங்கிலம்</option><option value="கணிதம்">கணிதம்</option><option value="அறிவியல்">அறிவியல்</option><option value="சமூக அறிவியல்">சமூக அறிவியல்</option>`
        : `<option value="${loggedInTeacher.subject}">${loggedInTeacher.subject}</option>`;
    ['bulk-subject', 'desc-subject', 'manage-subject', 'score-filter'].forEach(id => { let el = document.getElementById(id); if(el) el.innerHTML = subjectHtml; });
    let classHtml = `<option value="">வகுப்பு தேர்வு</option>`;
    loggedInTeacher.classes.sort((a,b)=>a-b).forEach(cls => { classHtml += `<option value="${cls}">${cls} ஆம் வகுப்பு</option>`; });
    ['bulk-class', 'desc-class', 'manage-class'].forEach(id => { let el = document.getElementById(id); if(el) el.innerHTML = classHtml; });
    // Show Settings tab for admin only
    let settingsTab = document.getElementById('tab-settings');
    if (settingsTab) settingsTab.classList.toggle('hidden', loggedInTeacher.subject !== 'அனைத்தும்');
    // Log login activity
    logActivity('login', loggedInTeacher.name + ' உள்ளே நுழைந்தார்');
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    ['dashboard','mcq','desc','manage','analytics','assignment','scores','ai','settings'].forEach(t => {
        let el = document.getElementById('admin-' + t + '-section');
        if (el) el.classList.add('hidden');
    });
    let tabBtn = document.getElementById('tab-' + tab);
    if (tabBtn) tabBtn.classList.add('active');
    let secEl = document.getElementById('admin-' + tab + '-section');
    if (secEl) secEl.classList.remove('hidden');
    if (tab === 'scores') loadLeaderboard();
    if (tab === 'manage') loadManageQuestions();
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'analytics') { setupAnalyticsFilters(); loadTeacherAnalytics(); }
    if (tab === 'assignment') { setupAssignmentSelects(); loadAssignments(); }
    if (tab === 'settings') { loadTeacherList(); switchSettingsTab('appearance'); }
    if (tab === 'ai') setupAiTab();
}

function verifyStudentLogin() {
    const name = document.getElementById('student-name').value.trim();
    const cls = document.getElementById('student-class').value;
    const errorMsg = document.getElementById('student-error');
    if (!name) { errorMsg.innerText = "உங்கள் பெயரை உள்ளிடவும்! ❌"; errorMsg.classList.remove('hidden'); return; }
    if (!cls) { errorMsg.innerText = "வகுப்பைத் தேர்ந்தெடுக்கவும்! ❌"; errorMsg.classList.remove('hidden'); return; }
    
    loggedInStudent = name; loggedInClass = cls;
    localStorage.setItem("quiz_student_name", loggedInStudent);
    localStorage.setItem("quiz_student_class", loggedInClass);
    errorMsg.classList.add('hidden');
    document.getElementById('student-name').value = ''; document.getElementById('student-class').value = '';
    
    if ('speechSynthesis' in window) {
        let speech = new SpeechSynthesisUtterance("வணக்கம் " + loggedInStudent);
        speech.lang = 'ta-IN'; 
        window.speechSynthesis.speak(speech);
    }

    document.getElementById('welcome-text').innerText = "வணக்கம், " + loggedInStudent + " (" + loggedInClass + " வகுப்பு) 👋";
    showScreen('subject-screen');
}

function studentLogout() { 
    localStorage.removeItem("quiz_student_name"); localStorage.removeItem("quiz_student_class");
    loggedInStudent = ""; loggedInClass = ""; goHome(); 
}

// அனைத்து தேவையற்ற இடைவெளிகளையும் நீக்க உதவும் Function
const cleanText = (str) => { 
    if (!str) return ''; 
    return str.replace(/[\r\t\u200B-\u200D\uFEFF]/g, '').trim(); 
};

// --- கேள்வி பதிவேற்றும் முறை (Bug Fixed) ---
async function uploadSimpleText() {
    const text    = (document.getElementById('simple-text') || {}).value || '';
    const subject = document.getElementById('bulk-subject').value;
    const cls     = document.getElementById('bulk-class').value;
    const chapter = (document.getElementById('bulk-chapter') || {}).value.trim() || window._uploadChapter || '';
    const diff    = (document.getElementById('bulk-difficulty') || {}).value || window._uploadDifficulty || 'medium';
    const statusEl  = document.getElementById('paste-status');
    const progWrap  = document.getElementById('mcq-upload-progress');
    const progBar   = document.getElementById('mcq-upload-bar');

    if (!cls)             { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ வகுப்பு தேர்வு செய்யவும்!'; return; }
    if (!subject)         { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ பாடம் தேர்வு செய்யவும்!'; return; }
    if (!cleanText(text)) { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ கேள்விகளை உள்ளிடவும்!'; return; }

    let rawLines = text.split('\n');
    let lines = rawLines.map(l => cleanText(l)).filter(Boolean);

    if (lines.length % 6 !== 0) {
        let total = lines.length, rem = lines.length % 6;
        statusEl.style.color = '#ef4444';
        statusEl.textContent = `❌ Format பிழை: ${total} வரிகள் உள்ளன (${rem} கூடுதல்). ஒரு கேள்விக்கு சரியாக 6 வரிகள் தேவை.`;
        // highlight which block has problem
        let errQ = Math.floor(lines.length / 6) + 1;
        alert(`பிழை! ${total} வரிகள் உள்ளன.\n${errQ}வது கேள்வி block-ல் வரிகள் குறைவு/அதிகம்.\nஒவ்வொரு கேள்விக்கும் சரியாக 6 வரிகள்:\n1. கேள்வி\n2. விருப்பம் A\n3. விருப்பம் B\n4. விருப்பம் C\n5. விருப்பம் D\n6. சரியான விடை`);
        return;
    }

    let totalQ = lines.length / 6;
    statusEl.style.color = '#6366f1';
    statusEl.textContent = `⏳ ${totalQ} கேள்விகள் சரிபார்க்கப்படுகிறது...`;
    if (progWrap) progWrap.classList.remove('hidden');
    if (progBar)  progBar.style.width = '10%';

    let errors = [], validQuestions = [], dupCount = 0;

    for (let i = 0; i < lines.length; i += 6) {
        const q = lines[i], o1 = lines[i+1], o2 = lines[i+2], o3 = lines[i+3], o4 = lines[i+4];
        let ans = lines[i+5];
        let qNum = i/6 + 1;
        let optionsArr = [o1, o2, o3, o4];
        let matchedAns = ans;

        // Auto-correct answer match
        if (!optionsArr.includes(ans)) {
            let found = optionsArr.find(opt => opt.toLowerCase().replace(/\s/g,'') === ans.toLowerCase().replace(/\s/g,''));
            if (found) {
                matchedAns = found;
            } else {
                errors.push(`கேள்வி ${qNum}: விடை "${ans}" விருப்பங்களில் இல்லை`);
                continue;
            }
        }

        // Duplicate check
        let isDup = await checkDuplicate(q, subject, cls).catch(() => false);
        if (isDup) { dupCount++; continue; }

        validQuestions.push({ subject, class: cls, type:'mcq', question:q, options:optionsArr, answer:matchedAns, chapter, difficulty:diff });
        if (progBar) progBar.style.width = (10 + Math.round((i/lines.length)*60)) + '%';
    }

    if (errors.length) {
        let errEl = document.getElementById('mcq-stat-err');
        if (errEl) { errEl.textContent = `❌ ${errors.length} பிழைகள்`; errEl.classList.remove('hidden'); }
        console.warn('MCQ Upload errors:', errors);
    }
    if (dupCount) {
        let dupEl = document.getElementById('mcq-stat-dup');
        if (dupEl) { dupEl.textContent = `⚠️ ${dupCount} duplicates தவிர்க்கப்பட்டன`; dupEl.classList.remove('hidden'); }
    }
    if (!validQuestions.length) {
        if (progWrap) progWrap.classList.add('hidden');
        statusEl.style.color = '#ef4444';
        statusEl.textContent = `❌ Upload ஆக valid கேள்விகள் இல்லை! ${errors.length} பிழைகள், ${dupCount} duplicates.`;
        return;
    }

    // Batch upload (Firestore max 500/batch)
    if (progBar) progBar.style.width = '75%';
    statusEl.textContent = `📤 ${validQuestions.length} கேள்விகள் upload ஆகிறது...`;

    const BATCH_SIZE = 400;
    let uploaded = 0;
    for (let b = 0; b < validQuestions.length; b += BATCH_SIZE) {
        let batch = db.batch();
        validQuestions.slice(b, b + BATCH_SIZE).forEach(qData => {
            let docRef = db.collection('quiz_questions').doc();
            batch.set(docRef, qData);
        });
        await batch.commit();
        uploaded += Math.min(BATCH_SIZE, validQuestions.length - b);
        if (progBar) progBar.style.width = (75 + Math.round((uploaded/validQuestions.length)*25)) + '%';
    }

    statusEl.style.color = '#10b981';
    statusEl.textContent = `✅ ${uploaded} கேள்விகள் சேர்க்கப்பட்டன!${dupCount?' ('+dupCount+' dup skip)':''}${errors.length?' ('+errors.length+' errors)':''}`;
    logActivity('upload', `${uploaded} MCQ கேள்விகள் upload (${subject}, ${cls} வகுப்பு${chapter?' - '+chapter:''})`);
    document.getElementById('simple-text').value = '';
    livePreviewMCQ();
    setTimeout(() => {
        statusEl.textContent = '';
        if (progWrap) progWrap.classList.add('hidden');
        let errEl = document.getElementById('mcq-stat-err'); if (errEl) errEl.classList.add('hidden');
        let dupEl = document.getElementById('mcq-stat-dup'); if (dupEl) dupEl.classList.add('hidden');
    }, 6000);
}

// --- 2 & 5 மார்க் கேள்வி பதிவேற்றும் முறை ---
async function uploadDescQuestion() {
    const question = document.getElementById('desc-q-input').value.trim();
    const answer   = document.getElementById('desc-ans-input').value.trim();
    const subject  = document.getElementById('desc-subject').value;
    const cls      = document.getElementById('desc-class').value;
    const statusEl = document.getElementById('desc-status');
    if (!cls || !question || !answer) return alert("அனைத்து விவரங்களையும் நிரப்பவும்!");
    statusEl.innerText = "சேர்க்கப்படுகிறது... ⏳";
    try {
        await db.collection("desc_questions").add({
            subject: subject, class: cls, type: 'desc',
            question: question, answer: answer,
            chapter: window._uploadChapter || '',
            difficulty: window._uploadDifficulty || 'medium'
        });
        statusEl.style.color = "#10b981";
        statusEl.innerText = "✅ கேள்வி சேர்க்கப்பட்டது!";
        document.getElementById('desc-q-input').value = '';
        document.getElementById('desc-ans-input').value = '';
        setTimeout(() => statusEl.innerText = '', 4000);
    } catch(e) {
        statusEl.style.color = "#ef4444";
        statusEl.innerText = "❌ பிழை: " + e.message;
    }
}


// --- நிர்வகிக்கும் பகுதி ---
let _allManageItems = [];

function loadManageQuestions() {
    const subject = document.getElementById('manage-subject').value;
    const cls = document.getElementById('manage-class').value;
    const list = document.getElementById('manage-list');
    const countEl = document.getElementById('manage-q-count');
    const delAllBtn = document.getElementById('delete-all-btn');
    const qType = document.querySelector('input[name="manage-type"]:checked').value;
    const collectionName = qType === 'mcq' ? 'quiz_questions' : 'desc_questions';
    delAllBtn.classList.add('hidden'); countEl.innerText = ""; _allManageItems = [];
    if (!subject) return; list.innerHTML = "⏳";
    let query = db.collection(collectionName).where("subject", "==", subject);
    if (cls) query = query.where("class", "==", cls);
    query.get().then(snap => {
        list.innerHTML = "";
        if (snap.empty) { list.innerHTML = '<p style="color:#94a3b8;font-weight:700;">கேள்விகள் இல்லை.</p>'; return; }
        countEl.innerText = `மொத்தம்: ${snap.size} கேள்விகள்`;
        delAllBtn.classList.remove('hidden');
        snap.forEach(doc => { let d = doc.data(); d._id = doc.id; d._col = collectionName; _allManageItems.push(d); });
        renderManageList(_allManageItems);
    });
}

function renderManageList(items) {
    const list = document.getElementById('manage-list'); list.innerHTML = "";
    const qType = document.querySelector('input[name="manage-type"]:checked').value;
    // Store items in a map for safe access
    window._manageItemsMap = {};
    items.forEach((data, idx) => {
        window._manageItemsMap[idx] = data;
        let diffColor = data.difficulty === 'hard' ? '#fee2e2' : data.difficulty === 'easy' ? '#d1fae5' : '#fef3c7';
        let diffTxt = data.difficulty === 'hard' ? '#dc2626' : data.difficulty === 'easy' ? '#065f46' : '#92400e';
        let diffBadge = data.difficulty ? `<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:${diffColor};color:${diffTxt};font-weight:800;">${data.difficulty}</span>` : '';
        let chBadge = data.chapter ? `<span style="font-size:11px;color:#64748b;font-weight:700;">📌 ${data.chapter}</span>` : '';
        let optHtml = (qType === 'mcq' && data.options) ? `<p style="font-size:12px;color:#64748b;margin:4px 0;">${(data.options||[]).join(' | ')}</p>` : '';
        list.innerHTML += `<div style="background:#fff;padding:12px;border:2px solid #e2e8f0;margin-bottom:8px;border-radius:12px;">
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:5px;flex-wrap:wrap;">${diffBadge}${chBadge}</div>
            <b style="font-size:14px;">${data.question}</b>${optHtml}
            <p style="color:#10b981;font-size:13px;font-weight:800;margin:4px 0;">✅ ${data.answer||''}</p>
            <div style="display:flex;gap:6px;margin-top:8px;">
                <button style="background:#4f46e5;box-shadow:0 4px 0 #3730a3;padding:6px 12px;font-size:13px;width:auto;margin:0;border-radius:10px;" onclick="openEditModalByIdx(${idx})">✏️ திருத்து</button>
                <button class="danger-btn" style="margin:0!important;" onclick="openDeleteModal('${data._id}','${data._col}','question')">🗑️ நீக்கு</button>
            </div></div>`;
    });
}

function filterManageList() {
    let q = (document.getElementById('manage-search').value || '').toLowerCase();
    renderManageList(!q ? _allManageItems : _allManageItems.filter(d => (d.question||'').toLowerCase().includes(q)||(d.answer||'').toLowerCase().includes(q)||(d.chapter||'').toLowerCase().includes(q)));
}


function loadLeaderboard() {
    const tbody = document.getElementById('scores-body'); tbody.innerHTML = "";
    const filterSubject = (document.getElementById('score-filter') || {}).value || '';
    const filterClass   = (document.getElementById('score-class-filter') || {}).value || '';
    // Populate class filter if empty
    let clsFilter = document.getElementById('score-class-filter');
    if (clsFilter && clsFilter.options.length <= 1 && loggedInTeacher) {
        loggedInTeacher.classes.forEach(c => { let o = document.createElement('option'); o.value = c; o.textContent = c + ' ஆம் வகுப்பு'; clsFilter.appendChild(o); });
    }
    let query = db.collection("quiz_scores").orderBy("timestamp", "desc");
    query.get().then((snapshot) => {
        let rows = [];
        snapshot.forEach(doc => { let d = doc.data(); d._id = doc.id; rows.push(d); });
        if (filterSubject) rows = rows.filter(r => r.subject === filterSubject);
        if (filterClass)   rows = rows.filter(r => r.studentClass === filterClass);
        rows.sort((a,b) => (b.score/b.total) - (a.score/a.total));

        const countEl = document.getElementById('scores-count');
        if (countEl) countEl.textContent = `மொத்தம்: ${rows.length} பதிவுகள்`;

        // Store rows in map so onclick can use index safely
        window._scoreRowsMap = {};

        rows.forEach((data, i) => {
            window._scoreRowsMap[i] = data._id;
            let pct = data.total > 0 ? Math.round(data.score/data.total*100) : 0;
            let medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
            let pctColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
            tbody.innerHTML += `<tr>
                <td>${medal} ${data.studentName}</td>
                <td>${data.studentClass}</td>
                <td>${data.subject}</td>
                <td style="font-weight:900;">${data.score}/${data.total}</td>
                <td style="font-weight:900;color:${pctColor};">${pct}%</td>
                <td><button class="danger-btn" style="margin:0!important;padding:5px 8px!important;font-size:12px!important;"
                    onclick="deleteScoreByIdx(${i})">🗑️</button></td>
            </tr>`;
        });
        if (!rows.length) tbody.innerHTML = '<tr><td colspan="6" style="color:#94a3b8;padding:20px;">பதிவுகள் இல்லை</td></tr>';
    });
}

function deleteScoreByIdx(idx) {
    const docId = (window._scoreRowsMap || {})[idx];
    if (!docId) { alert('ID கிடைக்கவில்லை! மீண்டும் load செய்யவும்.'); return; }
    openDeleteModal(docId, 'quiz_scores', 'score');
}

function toggleAddScoreForm() {
    let f = document.getElementById('add-score-form');
    if (f) f.classList.toggle('hidden');
}

async function addManualScore() {
    let name    = (document.getElementById('manual-name') || {}).value.trim();
    let cls     = (document.getElementById('manual-class') || {}).value.trim();
    let subject = (document.getElementById('manual-subject') || {}).value;
    let score   = parseInt((document.getElementById('manual-score') || {}).value) || 0;
    let total   = parseInt((document.getElementById('manual-total') || {}).value) || 10;
    let statusEl = document.getElementById('manual-score-status');
    if (!name || !cls) { statusEl.style.color='#ef4444'; statusEl.textContent='பெயர் & வகுப்பு தேவை!'; return; }
    statusEl.textContent = 'சேர்க்கப்படுகிறது...';
    try {
        await db.collection('quiz_scores').add({
            studentName: name, studentClass: cls, subject,
            score, total, timestamp: new Date().toISOString(), manual: true
        });
        statusEl.style.color = '#10b981'; statusEl.textContent = '✅ சேர்க்கப்பட்டது!';
        logActivity('manual', `${name} (${cls}) க்கு மதிப்பெண் நேரடியாக சேர்க்கப்பட்டது`);
        ['manual-name','manual-class','manual-score','manual-total'].forEach(id => { let el=document.getElementById(id); if(el) el.value=''; });
        setTimeout(() => { statusEl.textContent=''; loadLeaderboard(); }, 1200);
    } catch(e) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ பிழை: '+e.message; }
}

async function confirmDeleteAllScores() {
    let filterSubject = (document.getElementById('score-filter') || {}).value || '';
    let filterClass   = (document.getElementById('score-class-filter') || {}).value || '';
    let msg = filterSubject || filterClass
        ? `${filterSubject||'அனைத்து பாடம்'} / ${filterClass||'அனைத்து வகுப்பு'} பதிவுகளை நீக்கவா?`
        : 'அனைத்து மதிப்பெண் பதிவுகளையும் நீக்க வேண்டுமா? இதை மீண்டும் பெற முடியாது!';
    if (!confirm(msg)) return;
    let query = db.collection('quiz_scores');
    if (filterSubject) query = query.where('subject','==',filterSubject);
    if (filterClass)   query = query.where('studentClass','==',filterClass);
    const snap = await query.get();
    if (snap.empty) { alert('நீக்க பதிவுகள் இல்லை!'); return; }
    let batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    logActivity('delete', `${snap.size} மதிப்பெண் பதிவுகள் நீக்கப்பட்டன`);
    alert(`✅ ${snap.size} பதிவுகள் நீக்கப்பட்டன!`);
    loadLeaderboard();
}

function openDeleteModal(id, collectionName, type) { 
    itemToDelete = { id, collection: collectionName, type }; 
    document.getElementById('delete-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.add('active');
}
function closeDeleteModal() { 
    document.getElementById('delete-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.remove('active');
    itemToDelete = null; 
}
function closeAllModals() { closeDeleteModal(); closeEditModal(); }

function executeDelete() {
    if (!itemToDelete) return;
    const colName  = itemToDelete.collection;
    const docId    = itemToDelete.id;
    const itemType = itemToDelete.type; // save before closeDeleteModal nulls it
    db.collection(colName).doc(docId).delete().then(() => {
        closeDeleteModal();
        if (itemType === 'question') loadManageQuestions(); else loadLeaderboard();
    }).catch(err => {
        alert("பிழை: " + err.message);
        closeDeleteModal();
    });
}

// --- Delete All Logic ---
async function confirmDeleteAll() {
    const subject = document.getElementById('manage-subject').value;
    const cls = document.getElementById('manage-class').value;
    const qType = document.querySelector('input[name="manage-type"]:checked').value;
    const collectionName = qType === 'mcq' ? 'quiz_questions' : 'desc_questions';
    
    if(!subject) return alert("பாடத்தைத் தேர்ந்தெடுக்கவும்!");
    let msg = `${subject} பாடத்தின் அனைத்து கேள்விகளையும் நிச்சயமாக நீக்க வேண்டுமா? இதை மீண்டும் பெற முடியாது!`;
    if(!confirm(msg)) return;

    let query = db.collection(collectionName).where("subject", "==", subject);
    if (cls) query = query.where("class", "==", cls);

    const snap = await query.get();
    if(snap.empty) { alert("நீக்க கேள்விகள் இல்லை!"); return; }

    let batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    alert("✅ அனைத்து கேள்விகளும் வெற்றிகரமாக நீக்கப்பட்டன!");
    loadManageQuestions();
}

function shuffle(arr) { let a = [...arr]; for (let i = a.length - 1; i > 0; i--) { let j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function selectQuizType(type) {
    // Wrong practice mode — load from localStorage directly
    if (window._wrongPracticeMode) {
        let wrongs = [];
        try { wrongs = JSON.parse(localStorage.getItem('ua_wrong_qs') || '[]'); } catch(e) {}
        if (!wrongs.length) { alert('தவறான கேள்விகள் இல்லை!'); window._wrongPracticeMode = false; return; }
        // Convert stored wrong Q objects to quiz format (question text + answer only)
        currentActiveSubject = document.getElementById('student-subject-select').value;
        activeQuizType = 'mcq';
        // Build MCQ-like objects from wrong list — only question+answer known
        currentQuestions = wrongs.map(w => ({
            question: w.question,
            answer: w.answer,
            options: shuffleArr([w.answer, '—', '—', '—']) // placeholders; real options not stored
        }));
        // Better: re-fetch full questions matching the stored question texts
        document.getElementById('loading').classList.remove('hidden');
        db.collection('quiz_questions')
          .where("class", "==", loggedInClass)
          .get().then(snap => {
            document.getElementById('loading').classList.add('hidden');
            let wrongTexts = wrongs.map(w => w.question);
            let matched = [];
            snap.forEach(doc => { let d = doc.data(); if (wrongTexts.includes(d.question)) matched.push(d); });
            if (!matched.length) matched = wrongs.map(w => ({ question: w.question, answer: w.answer, options: [w.answer] }));
            currentQuestions = matched;
            window._isExamMode = false;
            startMCQQuiz();
        }).catch(() => {
            document.getElementById('loading').classList.add('hidden');
            currentQuestions = wrongs.map(w => ({ question: w.question, answer: w.answer, options: [w.answer] }));
            startMCQQuiz();
        });
        return;
    }

    currentActiveSubject = document.getElementById('student-subject-select').value;
    window._lastQuizSubject = currentActiveSubject;
    activeQuizType = type;
    document.getElementById('loading').classList.remove('hidden');
    const collectionName = type === 'mcq' ? 'quiz_questions' : 'desc_questions';

    let query = db.collection(collectionName)
        .where("subject", "==", currentActiveSubject)
        .where("class", "==", loggedInClass);

    query.get().then((snap) => {
        document.getElementById('loading').classList.add('hidden');
        if (snap.empty) return alert("இந்த பாடத்தில் இன்னும் கேள்விகள் வரவில்லை!");

        let allQ = [];
        snap.forEach(doc => allQ.push(doc.data()));

        // Chapter filter
        let chapter = window._quizChapter || 'all';
        if (chapter !== 'all') allQ = allQ.filter(q => q.chapter === chapter);

        // Difficulty filter
        let diff = window._quizDifficulty || 'all';
        if (diff !== 'all') allQ = allQ.filter(q => q.difficulty === diff);

        if (!allQ.length) return alert("தேர்ந்தெடுத்த filter-ல் கேள்விகள் இல்லை!");

        // Question count
        let qCount = window._quizQCount || 10;
        currentQuestions = shuffle(allQ).slice(0, qCount);

        if (type === 'mcq') startMCQQuiz(); else startDescQuiz();
    }).catch(err => {
        document.getElementById('loading').classList.add('hidden');
        alert("பிழை: " + err.message);
    });
}

function shuffleArr(arr) { let a = [...arr]; for (let i = a.length-1; i > 0; i--) { let j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }


function startMCQQuiz() { 
    currentQuestionIndex = 0; score = 0; wrongCount = 0; missedCount = 0; userAnswersLog = [];
    showScreen('quiz-screen'); showMCQQuestion(); 
}

function showMCQQuestion() {
    document.getElementById('next-btn').classList.add('hidden');
    const q = currentQuestions[currentQuestionIndex];

    // Progress bar
    const pct = Math.round((currentQuestionIndex / currentQuestions.length) * 100);
    const pb = document.getElementById('mcq-progress');
    if (pb) pb.style.width = pct + '%';

    // Question number badge
    const qnb = document.getElementById('quiz-qnum-badge');
    if (qnb) qnb.textContent = (currentQuestionIndex + 1) + ' / ' + currentQuestions.length;

    document.getElementById('question-text').innerText = (currentQuestionIndex + 1) + ". " + q.question;
    const opts = document.getElementById('options-container'); opts.innerHTML = "";

    // Hide training hint
    const hintBox = document.getElementById('training-hint');
    if (hintBox) hintBox.classList.add('hidden');

    let optList = (q.options && q.options.length > 1) ? q.options : [q.answer];
    shuffle(optList).forEach(opt => {
        let btn = document.createElement('button'); btn.innerText = opt; btn.className = 'option-btn';
        btn.onclick = () => checkMCQAnswer(opt, q.answer); opts.appendChild(btn);
    });

    // Timer: only in Exam mode — use settings value
    if (timerInterval) clearInterval(timerInterval);
    const timerWrap = document.getElementById('timer-badge-wrap');

    if (window._isExamMode) {
        if (timerWrap) timerWrap.style.display = '';
        timeLeft = window._quizTimerSeconds || 30;
        document.getElementById('time-left').innerText = timeLeft;
        timerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('time-left').innerText = timeLeft;
            if (timeLeft <= 0) { clearInterval(timerInterval); checkMCQAnswer(null, q.answer); }
        }, 1000);
    } else {
        if (timerWrap) timerWrap.style.display = 'none';
    }
}

function checkMCQAnswer(selected, correct) {
    clearInterval(timerInterval);
    
    let safeSelected = selected ? selected.trim() : null;
    let safeCorrect = correct ? correct.trim() : null;
    
    userAnswersLog.push({ question: currentQuestions[currentQuestionIndex].question, selected: safeSelected, correct: safeCorrect });
    
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        let btnText = btn.innerText.trim();
        if (btnText === safeCorrect) btn.classList.add('correct');
        else if (btnText === safeSelected) btn.classList.add('wrong');
    });
    
    if (safeSelected === safeCorrect) { 
        score++; 
        playSound('correct');
    } else if (safeSelected === null) { 
        missedCount++; 
        playSound('wrong');
        // Store missed as wrong
        saveWrongQuestion(currentQuestions[currentQuestionIndex].question, safeCorrect);
    } else { 
        wrongCount++; 
        playSound('wrong');
        // Store wrong answer for practice
        saveWrongQuestion(currentQuestions[currentQuestionIndex].question, safeCorrect);
    }

    // Training mode: show correct answer hint
    if (!window._isExamMode) {
        const hintBox = document.getElementById('training-hint');
        if (hintBox) {
            if (safeSelected !== safeCorrect) {
                hintBox.textContent = '✅ சரியான விடை: ' + safeCorrect;
                hintBox.classList.remove('hidden');
            }
        }
    }
    
    document.getElementById('next-btn').classList.remove('hidden');
}

function saveWrongQuestion(question, answer) {
    try {
        let wrongs = JSON.parse(localStorage.getItem('ua_wrong_qs') || '[]');
        let exists = wrongs.some(w => w.question === question);
        if (!exists) { wrongs.push({ question: question, answer: answer }); localStorage.setItem('ua_wrong_qs', JSON.stringify(wrongs)); }
        if (!window._wrongQsThisSession) window._wrongQsThisSession = [];
        window._wrongQsThisSession.push({ question, answer });
    } catch(e) {}
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuestions.length) showMCQQuestion();
    else showMCQResult();
}

function showMCQResult() {
    clearInterval(timerInterval);
    // Complete progress bar
    const pb = document.getElementById('mcq-progress');
    if (pb) pb.style.width = '100%';

    const pct = Math.round((score / currentQuestions.length) * 100);
    document.getElementById('feedback-msg').innerText = pct >= 80 ? "சிறப்பு! 🌟" : pct >= 50 ? "வாழ்த்துகள்! 👍" : "மேலும் பயிற்சி தேவை! 💪";
    document.getElementById('score-text').innerText = `மதிப்பெண்: ${score} / ${currentQuestions.length}`;
    window._lastQuizSubject = currentActiveSubject;

    // Clear wrong practice flag after session
    if (window._wrongPracticeMode) {
        window._wrongPracticeMode = false;
        localStorage.removeItem('ua_wrong_qs');
    }

    showScreen('result-screen');
    db.collection("quiz_scores").add({
        studentName: loggedInStudent, studentClass: loggedInClass, subject: currentActiveSubject,
        score: score, total: currentQuestions.length, timestamp: new Date().toISOString()
    });
    // Mark assignment complete if student came from an assignment
    markAssignmentComplete(currentActiveSubject, score, currentQuestions.length);
}

function showReviewScreen() {
    let html = "";
    userAnswersLog.forEach((log, i) => {
        let isCorrect = log.selected === log.correct;
        let color = isCorrect ? "#10b981" : "#ef4444";
        let ansText = log.selected === null ? "நேரம் முடிந்தது ⏱️" : log.selected;
        html += `<div style="background:#f8fafc; padding:15px; border-radius:15px; margin-bottom:15px; border-left: 6px solid ${color};">
            <p style="font-weight:800; color:#1e293b; margin-top:0; font-size: 15px;">${i+1}. ${log.question}</p>
            <p style="color:#64748b; font-weight:600; margin:5px 0; font-size: 14px;">உங்கள் விடை: <span style="color:${color};">${ansText}</span></p>
            ${!isCorrect ? `<p style="color:#10b981; font-weight:800; margin:5px 0; font-size: 14px;">✅ சரியான விடை: ${log.correct}</p>` : ''}
            </div>`;
    });
    document.getElementById('review-content').innerHTML = html; 
    showScreen('review-screen');
}

function startDescQuiz() { currentQuestionIndex = 0; showScreen('desc-quiz-screen'); showDescQuestion(); }

function showDescQuestion() {
    document.getElementById('desc-question-text').innerText = currentQuestions[currentQuestionIndex].question;
    document.getElementById('desc-answer-container').style.display = 'none';
    document.getElementById('show-ans-btn').classList.remove('hidden');
    document.getElementById('desc-next-btn').classList.add('hidden');
}

function revealDescAnswer() {
    document.getElementById('desc-answer-container').innerText = currentQuestions[currentQuestionIndex].answer;
    document.getElementById('desc-answer-container').style.display = 'block';
    document.getElementById('show-ans-btn').classList.add('hidden');
    document.getElementById('desc-next-btn').classList.remove('hidden');
}

function nextDescQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuestions.length) showDescQuestion(); else showScreen('desc-result-screen');
}

function showCertificate() {
    document.getElementById('cert-name').innerText = loggedInStudent;
    document.getElementById('cert-subject').innerText = currentActiveSubject;
    document.getElementById('cert-score').innerText = score + " / " + currentQuestions.length;
    document.getElementById('cert-class-display').innerText = loggedInClass + " ஆம் வகுப்பு";
    let today = new Date();
    let dateStr = today.getDate() + '/' + (today.getMonth() + 1) + '/' + today.getFullYear();
    document.getElementById('cert-date').innerText = dateStr;
    showScreen('certificate-screen');
}
// =================================================================
//  உங்கள் ஆசிரியர் v4.0 — Teacher Panel Features
// =================================================================

// ── Activity Log ─────────────────────────────────────────────────
function logActivity(type, message) {
    try {
        db.collection('activity_log').add({
            type: type, message: message,
            teacher: loggedInTeacher ? loggedInTeacher.name : '—',
            timestamp: new Date().toISOString()
        }).catch(() => {});
    } catch(e) {}
}

// ── Dashboard ─────────────────────────────────────────────────────
function loadDashboard() {
    let el = id => document.getElementById(id);
    // Counts
    Promise.all([
        db.collection('quiz_questions').get(),
        db.collection('desc_questions').get(),
        db.collection('quiz_scores').get(),
        db.collection('activity_log').orderBy('timestamp','desc').limit(20).get().catch(()=>({docs:[]}))
    ]).then(([mcqSnap, descSnap, scoresSnap, logSnap]) => {
        if(el('dash-questions')) el('dash-questions').textContent = mcqSnap.size + descSnap.size;
        if(el('dash-attempts')) el('dash-attempts').textContent = scoresSnap.size;
        // Unique students
        let students = new Set(); scoresSnap.forEach(d => students.add(d.data().studentName));
        if(el('dash-students')) el('dash-students').textContent = students.size;
        // Subject bars
        let subjCounts = {};
        mcqSnap.forEach(d => { let s = d.data().subject||'?'; subjCounts[s] = (subjCounts[s]||0)+1; });
        let maxQ = Math.max(1, ...Object.values(subjCounts));
        let colors = {'தமிழ்':'#3b82f6','ஆங்கிலம்':'#10b981','கணிதம்':'#f59e0b','அறிவியல்':'#8b5cf6','சமூக அறிவியல்':'#ef4444'};
        let barsHtml = Object.entries(subjCounts).map(([s,c]) =>
            `<div style="margin:6px 0;"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;margin-bottom:3px;"><span>${s}</span><span>${c}</span></div><div style="background:#e2e8f0;border-radius:8px;height:8px;overflow:hidden;"><div style="width:${Math.round(c/maxQ*100)}%;height:100%;background:${colors[s]||'#64748b'};border-radius:8px;"></div></div></div>`
        ).join('');
        if(el('dash-subject-bars')) el('dash-subject-bars').innerHTML = barsHtml || '<p style="color:#94a3b8;font-size:13px;">தரவு இல்லை</p>';
        // Top/Weak students
        let studentStats = {};
        scoresSnap.forEach(d => {
            let sd = d.data(); let n = sd.studentName;
            if(!studentStats[n]) studentStats[n] = {total:0, correct:0, attempts:0};
            studentStats[n].correct += sd.score; studentStats[n].total += sd.total; studentStats[n].attempts++;
        });
        let sorted = Object.entries(studentStats).map(([n,s]) => ({name:n, pct:s.total>0?Math.round(s.correct/s.total*100):0, attempts:s.attempts})).sort((a,b)=>b.pct-a.pct);
        let topHtml = sorted.slice(0,3).map((s,i)=>`<div class="dash-card"><span>${['🥇','🥈','🥉'][i]}</span><span style="flex:1;">${s.name}</span><span style="color:#10b981;font-weight:900;">${s.pct}%</span></div>`).join('');
        let weakHtml = sorted.filter(s=>s.pct<50&&s.attempts>=2).slice(0,4).map(s=>`<div class="dash-card"><span>⚠️</span><span style="flex:1;">${s.name}</span><span style="color:#ef4444;font-weight:900;">${s.pct}%</span></div>`).join('');
        if(el('dash-top-students')) el('dash-top-students').innerHTML = topHtml || '<p style="color:#94a3b8;font-size:13px;">தரவு இல்லை</p>';
        if(el('dash-weak-students')) el('dash-weak-students').innerHTML = weakHtml || '<p style="color:#94a3b8;font-size:13px;">அனைவரும் சிறப்பு! 🎉</p>';
        // Activity log
        let logHtml = '';
        if(logSnap.docs) logSnap.docs.forEach(d => {
            let ld = d.data(); let t = (ld.timestamp||'').substring(0,16).replace('T',' ');
            logHtml += `<div class="activity-item ${ld.type||''}">${t} — ${ld.message||''}</div>`;
        });
        if(el('dash-activity-log')) el('dash-activity-log').innerHTML = logHtml || '<p style="color:#94a3b8;font-size:13px;">பதிவு இல்லை</p>';
    }).catch(() => {});
}

// ── Teacher Analytics ─────────────────────────────────────────────
function setupAnalyticsFilters() {
    if(!loggedInTeacher) return;
    let subjectHtml = loggedInTeacher.subject === "அனைத்தும்"
        ? `<option value="">அனைத்து பாடங்கள்</option><option value="தமிழ்">தமிழ்</option><option value="ஆங்கிலம்">ஆங்கிலம்</option><option value="கணிதம்">கணிதம்</option><option value="அறிவியல்">அறிவியல்</option><option value="சமூக அறிவியல்">சமூக அறிவியல்</option>`
        : `<option value="${loggedInTeacher.subject}">${loggedInTeacher.subject}</option>`;
    let anaSubj = document.getElementById('ana-subject-filter'); if(anaSubj) anaSubj.innerHTML = subjectHtml;
    let classHtml = '<option value="">அனைத்து வகுப்புகள்</option>';
    loggedInTeacher.classes.forEach(c => { classHtml += `<option value="${c}">${c} ஆம் வகுப்பு</option>`; });
    let anaCls = document.getElementById('ana-class-filter'); if(anaCls) anaCls.innerHTML = classHtml;
}

function loadTeacherAnalytics() {
    let cls = (document.getElementById('ana-class-filter')||{}).value || '';
    let subj = (document.getElementById('ana-subject-filter')||{}).value || '';
    let query = db.collection('quiz_scores');
    if(subj) query = query.where('subject','==',subj);
    if(cls) query = query.where('studentClass','==',cls);
    query.get().then(snap => {
        let studentMap = {}, wrongMap = {};
        snap.forEach(d => {
            let sd = d.data(); let n = sd.studentName;
            if(!studentMap[n]) studentMap[n] = {correct:0,total:0,attempts:0};
            studentMap[n].correct += sd.score; studentMap[n].total += sd.total; studentMap[n].attempts++;
        });
        // Student table
        let rows = Object.entries(studentMap).map(([n,s]) => {
            let pct = s.total>0?Math.round(s.correct/s.total*100):0;
            let status = pct>=80?'<span style="color:#10b981;font-weight:800;">💪 சிறப்பு</span>':pct>=50?'<span style="color:#f59e0b;font-weight:800;">👍 சராசரி</span>':'<span style="color:#ef4444;font-weight:800;">⚠️ கவனம்</span>';
            return `<tr><td>${n}</td><td>${pct}%</td><td>${s.attempts}</td><td>${status}</td></tr>`;
        }).join('');
        let tb = document.getElementById('ana-student-table'); if(tb) tb.innerHTML = rows || '<tr><td colspan="4" style="color:#94a3b8;">தரவு இல்லை</td></tr>';
        // Class average
        let allCorrect = 0, allTotal = 0;
        Object.values(studentMap).forEach(s => { allCorrect+=s.correct; allTotal+=s.total; });
        let avgEl = document.getElementById('ana-class-avg');
        if(avgEl) avgEl.textContent = allTotal>0 ? Math.round(allCorrect/allTotal*100)+'%' : '—';
        // Hard questions (from userAnswersLog — Firestore not storing per-Q, show placeholder)
        let hqEl = document.getElementById('ana-hard-questions');
        if(hqEl) hqEl.innerHTML = '<p style="color:#94a3b8;font-size:13px;">கேள்வி வாரியான பகுப்பாய்வுக்கு quiz_answers collection தேவை.</p>';
    }).catch(() => {});
}

// ── Edit Question Modal ───────────────────────────────────────────
// ── Open Edit Modal by index (safe — no inline JSON) ─────────────
function openEditModalByIdx(idx) {
    let data = (window._manageItemsMap || {})[idx];
    if (!data) { alert('கேள்வி data கிடைக்கவில்லை!'); return; }
    openEditModal(data._id, data._col, data);
}

function openEditModal(docId, col, data) {
    // data can be object or JSON string
    if (typeof data === 'string') {
        try { data = JSON.parse(data.replace(/&#39;/g,"'")); } catch(e) { alert('Parse error: ' + e.message); return; }
    }
    document.getElementById('edit-doc-id').value  = docId;
    document.getElementById('edit-collection').value = col;
    document.getElementById('edit-question').value = data.question || '';
    document.getElementById('edit-answer').value   = data.answer || '';
    document.getElementById('edit-chapter').value  = data.chapter || '';
    document.getElementById('edit-difficulty').value = data.difficulty || 'medium';

    let optsSection = document.getElementById('edit-options-section');
    if (col === 'quiz_questions' && data.options && data.options.length) {
        optsSection.style.display = '';
        ['edit-opt1','edit-opt2','edit-opt3','edit-opt4'].forEach((id,i) => {
            let el = document.getElementById(id);
            if (el) el.value = (data.options||[])[i] || '';
        });
    } else {
        optsSection.style.display = 'none';
    }
    document.getElementById('edit-status').textContent = '';
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.add('active');
}
function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.remove('active');
}
async function saveEditedQuestion() {
    let docId = document.getElementById('edit-doc-id').value;
    let col = document.getElementById('edit-collection').value;
    let question = document.getElementById('edit-question').value.trim();
    let answer = document.getElementById('edit-answer').value.trim();
    let chapter = document.getElementById('edit-chapter').value.trim();
    let difficulty = document.getElementById('edit-difficulty').value;
    let statusEl = document.getElementById('edit-status');
    if(!question||!answer) { statusEl.style.color='#ef4444'; statusEl.textContent='கேள்வி மற்றும் விடை தேவை!'; return; }
    let updateData = { question, answer, chapter, difficulty };
    if(col === 'quiz_questions') {
        let opts = ['edit-opt1','edit-opt2','edit-opt3','edit-opt4'].map(id => (document.getElementById(id)||{}).value||'').filter(Boolean);
        if(opts.length === 4) updateData.options = opts;
        // Ensure answer is in options
        if(opts.length && !opts.includes(answer)) { statusEl.style.color='#ef4444'; statusEl.textContent='விடை விருப்பங்களில் இருக்க வேண்டும்!'; return; }
    }
    statusEl.textContent = 'சேமிக்கப்படுகிறது...';
    try {
        await db.collection(col).doc(docId).update(updateData);
        statusEl.style.color='#10b981'; statusEl.textContent='✅ சேமிக்கப்பட்டது!';
        logActivity('edit', `கேள்வி திருத்தப்பட்டது: ${question.substring(0,30)}...`);
        setTimeout(() => { closeEditModal(); loadManageQuestions(); }, 1200);
    } catch(e) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ பிழை: '+e.message; }
}

// ── Live MCQ Preview ──────────────────────────────────────────────
// ── MCQ Tab Switch ────────────────────────────────────────────────
function switchMcqTab(tab) {
    ['bulk','single','file'].forEach(t => {
        let panel = document.getElementById('mcq-' + t + '-panel');
        let btn   = document.getElementById('mcq-tab-' + t);
        if (panel) panel.classList.toggle('hidden', t !== tab);
        if (btn) {
            btn.style.background = t === tab ? 'linear-gradient(135deg,#4f46e5,#3730a3)' : '#94a3b8';
            btn.style.boxShadow  = t === tab ? '0 3px 0 #312e81' : '0 3px 0 #64748b';
        }
    });
}

// ── Insert Template ───────────────────────────────────────────────
function insertMcqTemplate() {
    let ta = document.getElementById('simple-text');
    if (!ta) return;
    let template = `சூரியன் எந்த திசையில் உதிக்கிறது?
கிழக்கு
மேற்கு
வடக்கு
தெற்கு
கிழக்கு

தமிழ்நாட்டின் தலைநகரம் எது?
சென்னை
மதுரை
கோயம்புத்தூர்
திருச்சி
சென்னை
`;
    ta.value = template;
    livePreviewMCQ();
}

// ── Clear MCQ Form ────────────────────────────────────────────────
function clearMcqForm() {
    let ta = document.getElementById('simple-text'); if (ta) ta.value = '';
    let st = document.getElementById('paste-status'); if (st) st.textContent = '';
    let pb = document.getElementById('mcq-preview-box'); if (pb) pb.classList.add('hidden');
    let lb = document.getElementById('mcq-line-badge'); if (lb) lb.textContent = '0 வரிகள்';
    let sq = document.getElementById('mcq-stat-q'); if (sq) sq.textContent = '0 கேள்விகள்';
    ['mcq-stat-err','mcq-stat-dup'].forEach(id => { let el=document.getElementById(id); if(el) el.classList.add('hidden'); });
}

// ── Live Preview MCQ (upgraded) ───────────────────────────────────
function livePreviewMCQ() {
    let ta = document.getElementById('simple-text');
    let text = ta ? ta.value : '';
    let previewBox     = document.getElementById('mcq-preview-box');
    let previewContent = document.getElementById('mcq-preview-content');
    let lineBadge      = document.getElementById('mcq-line-badge');
    let statQ          = document.getElementById('mcq-stat-q');
    let previewCount   = document.getElementById('mcq-preview-count');

    let lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lineBadge) lineBadge.textContent = lines.length + ' வரிகள்';

    let completeBlocks = Math.floor(lines.length / 6);
    let remainder      = lines.length % 6;
    if (statQ) statQ.textContent = completeBlocks + ' கேள்விகள்' + (remainder ? ` (+${remainder} incomplete)` : '');

    if (!text.trim() || completeBlocks === 0) {
        if (previewBox) previewBox.classList.add('hidden');
        return;
    }

    let html = '';
    for (let i = 0; i < completeBlocks * 6; i += 6) {
        let q = lines[i], o1 = lines[i+1], o2 = lines[i+2], o3 = lines[i+3], o4 = lines[i+4], ans = lines[i+5];
        let ansInOpts = [o1,o2,o3,o4].includes(ans);
        let borderColor = ansInOpts ? '#6366f1' : '#fca5a5';
        let bgColor     = ansInOpts ? '#fafafa' : '#fff5f5';
        html += `<div style="border:2px solid ${borderColor};border-radius:12px;padding:10px;margin-bottom:8px;background:${bgColor};">
            <div style="font-size:13px;font-weight:800;color:#1e293b;margin-bottom:6px;">${i/6+1}. ${q}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px;">
                ${[o1,o2,o3,o4].map((o,oi)=>`<span style="padding:3px 10px;border-radius:8px;font-size:12px;font-weight:700;
                    background:${o===ans?'#d1fae5':'#f1f5f9'};border:1.5px solid ${o===ans?'#10b981':'#e2e8f0'};
                    color:${o===ans?'#065f46':'#475569'};">
                    ${['A','B','C','D'][oi]}: ${o}</span>`).join('')}
            </div>
            ${!ansInOpts?`<p style="font-size:11px;color:#ef4444;font-weight:800;margin:0;">⚠️ விடை "${ans}" விருப்பங்களில் இல்லை!</p>`:''}
        </div>`;
    }
    // Incomplete block indicator
    if (remainder > 0) {
        html += `<div style="border:2px dashed #fca5a5;border-radius:12px;padding:8px;background:#fff5f5;text-align:center;">
            <p style="font-size:12px;color:#ef4444;font-weight:800;margin:0;">⚠️ ${remainder} வரிகள் incomplete (${6-remainder} வரிகள் குறைவு)</p>
        </div>`;
    }

    if (previewContent) previewContent.innerHTML = html;
    if (previewBox) previewBox.classList.remove('hidden');
    if (previewCount) previewCount.textContent = completeBlocks + ' கேள்விகள் ready';
}

// ── Single MCQ Upload ─────────────────────────────────────────────
async function uploadSingleMCQ() {
    let question = (document.getElementById('single-question') || {}).value.trim();
    let o1 = (document.getElementById('single-opt1') || {}).value.trim();
    let o2 = (document.getElementById('single-opt2') || {}).value.trim();
    let o3 = (document.getElementById('single-opt3') || {}).value.trim();
    let o4 = (document.getElementById('single-opt4') || {}).value.trim();
    let answer  = (document.getElementById('single-answer') || {}).value;
    let subject = document.getElementById('bulk-subject').value;
    let cls     = document.getElementById('bulk-class').value;
    let chapter = (document.getElementById('bulk-chapter') || {}).value.trim();
    let diff    = (document.getElementById('bulk-difficulty') || {}).value;
    let statusEl = document.getElementById('single-mcq-status');

    if (!question || !o1 || !o2 || !o3 || !o4) { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ கேள்வி + 4 விருப்பங்கள் தேவை!'; return; }
    if (!answer) { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ சரியான விடை தேர்வு செய்யவும்!'; return; }
    if (!cls || !subject) { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ வகுப்பு & பாடம் தேர்வு செய்யவும்!'; return; }

    statusEl.style.color = '#6366f1'; statusEl.textContent = '⏳ சேர்க்கப்படுகிறது...';
    try {
        await db.collection('quiz_questions').add({ subject, class:cls, type:'mcq', question, options:[o1,o2,o3,o4], answer, chapter, difficulty:diff });
        statusEl.style.color = '#10b981'; statusEl.textContent = '✅ கேள்வி சேர்க்கப்பட்டது!';
        logActivity('upload', `Single MCQ: "${question.substring(0,40)}..."`);
        ['single-question','single-opt1','single-opt2','single-opt3','single-opt4'].forEach(id => { let el=document.getElementById(id); if(el) el.value=''; });
        let sa = document.getElementById('single-answer'); if (sa) sa.value = '';
        setTimeout(() => statusEl.textContent = '', 3000);
    } catch(e) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ பிழை: '+e.message; }
}

// ── Single MCQ — auto-populate answer dropdown ────────────────────
(function watchSingleOpts() {
    function watch() {
        ['single-opt1','single-opt2','single-opt3','single-opt4'].forEach(id => {
            let el = document.getElementById(id);
            if (el) el.oninput = updateSingleAnswerDropdown;
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else setTimeout(watch, 600);
})();
function updateSingleAnswerDropdown() {
    let opts = ['single-opt1','single-opt2','single-opt3','single-opt4'].map(id => (document.getElementById(id)||{}).value||'').filter(Boolean);
    let sa = document.getElementById('single-answer'); if (!sa) return;
    let prev = sa.value;
    sa.innerHTML = '<option value="">✅ சரியான விடை தேர்வு</option>' + opts.map(o => `<option value="${o.replace(/"/g,'&quot;')}">${o}</option>`).join('');
    if (opts.includes(prev)) sa.value = prev;
}

// ── File Import ───────────────────────────────────────────────────
function handleMcqFileDrop(e) {
    e.preventDefault();
    document.getElementById('mcq-file-drop').classList.remove('dragover');
    let file = e.dataTransfer.files[0];
    if (file) loadMcqFile(file);
}
function handleMcqFileSelect(e) { if (e.target.files[0]) loadMcqFile(e.target.files[0]); }
function loadMcqFile(file) {
    let statusEl = document.getElementById('mcq-file-status');
    if (!file.name.endsWith('.txt')) { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ .txt file மட்டும்!'; return; }
    let reader = new FileReader();
    reader.onload = e => {
        let content = e.target.result;
        let ta = document.getElementById('simple-text'); if (ta) ta.value = content;
        switchMcqTab('bulk');
        livePreviewMCQ();
        statusEl.style.color = '#10b981'; statusEl.textContent = `✅ ${file.name} load ஆனது!`;
    };
    reader.readAsText(file, 'UTF-8');
}

// ── Export Questions — TXT / CSV / Excel ─────────────────────────
function exportQuestions(qtype, format) {
    // If called from button without format, show modal
    if (!format) { showExportModal(qtype); return; }

    let subject = document.getElementById(qtype==='mcq'?'bulk-subject':'desc-subject').value;
    let cls     = document.getElementById(qtype==='mcq'?'bulk-class':'desc-class').value;
    let col     = qtype==='mcq' ? 'quiz_questions' : 'desc_questions';
    if (!subject) return alert('பாடத்தைத் தேர்ந்தெடுக்கவும்!');

    let query = db.collection(col).where('subject','==',subject);
    if (cls) query = query.where('class','==',cls);

    query.get().then(snap => {
        if (snap.empty) return alert('கேள்விகள் இல்லை!');
        let rows = [];
        snap.forEach(doc => rows.push(doc.data()));

        let filename = `${subject}_${cls||'all'}_${qtype}`;

        if (format === 'txt') {
            let text = rows.map((d,i) => {
                if (qtype === 'mcq') return `${i+1}. ${d.question}\n${(d.options||[]).join('\n')}\nAnswer: ${d.answer}`;
                return `${i+1}. ${d.question}\nAnswer: ${d.answer}`;
            }).join('\n\n---\n\n');
            downloadFile(text, filename+'.txt', 'text/plain;charset=utf-8');

        } else if (format === 'csv') {
            let csvRows = [];
            if (qtype === 'mcq') {
                csvRows.push(['#','Question','Option A','Option B','Option C','Option D','Answer','Subject','Class','Chapter','Difficulty']);
                rows.forEach((d,i) => {
                    let opts = d.options || ['','','',''];
                    csvRows.push([i+1, d.question, opts[0]||'', opts[1]||'', opts[2]||'', opts[3]||'', d.answer, d.subject, d.class, d.chapter||'', d.difficulty||'']);
                });
            } else {
                csvRows.push(['#','Question','Answer','Subject','Class','Chapter','Difficulty']);
                rows.forEach((d,i) => csvRows.push([i+1, d.question, d.answer, d.subject, d.class, d.chapter||'', d.difficulty||'']));
            }
            let csvText = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
            // BOM for Tamil UTF-8 in Excel
            downloadFile('\uFEFF'+csvText, filename+'.csv', 'text/csv;charset=utf-8');

        } else if (format === 'excel') {
            buildExcel(rows, qtype, filename);
        }

        logActivity('export', `${subject} ${cls||''} ${qtype} கேள்விகள் ${format.toUpperCase()} export`);
    }).catch(e => alert('பிழை: '+e.message));
}

// ── Build Excel (XLSX without library — XML SpreadsheetML) ────────
function buildExcel(rows, qtype, filename) {
    let isMCQ = qtype === 'mcq';
    let headers = isMCQ
        ? ['#','கேள்வி','Option A','Option B','Option C','Option D','சரியான விடை','பாடம்','வகுப்பு','அத்தியாயம்','கடினம்']
        : ['#','கேள்வி','விடை','பாடம்','வகுப்பு','அத்தியாயம்','கடினம்'];

    let styleHeader = 's="1"';
    let styleCorrect = 's="2"';
    let styleNormal  = '';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles>
 <Style ss:ID="1"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="12"/><Interior ss:Color="#4f46e5" ss:Pattern="Solid"/><Alignment ss:WrapText="1"/></Style>
 <Style ss:ID="2"><Font ss:Color="#065f46" ss:Bold="1"/><Interior ss:Color="#d1fae5" ss:Pattern="Solid"/><Alignment ss:WrapText="1"/></Style>
 <Style ss:ID="3"><Alignment ss:WrapText="1"/></Style>
 <Style ss:ID="4"><Interior ss:Color="#f0f9ff" ss:Pattern="Solid"/><Alignment ss:WrapText="1"/></Style>
</Styles>
<Worksheet ss:Name="Questions">
<Table>
<Column ss:Width="40"/>
<Column ss:Width="250"/>
${isMCQ?'<Column ss:Width="120"/><Column ss:Width="120"/><Column ss:Width="120"/><Column ss:Width="120"/>':''}
<Column ss:Width="140"/>
<Column ss:Width="80"/><Column ss:Width="60"/><Column ss:Width="120"/><Column ss:Width="80"/>
<Row>
${headers.map(h=>`<Cell ${styleHeader}><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('')}
</Row>`;

    rows.forEach((d, i) => {
        let opts = d.options || ['','','',''];
        let rowStyle = i % 2 === 1 ? 's="4"' : 's="3"';
        if (isMCQ) {
            xml += `<Row>
<Cell ${rowStyle}><Data ss:Type="Number">${i+1}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.question)}</Data></Cell>
${opts.map((o,oi)=>`<Cell ${o===d.answer?styleCorrect:rowStyle}><Data ss:Type="String">${escXml(o)}</Data></Cell>`).join('')}
<Cell ${styleCorrect}><Data ss:Type="String">${escXml(d.answer)}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.subject||'')}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.class||'')}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.chapter||'')}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.difficulty||'')}</Data></Cell>
</Row>`;
        } else {
            xml += `<Row>
<Cell ${rowStyle}><Data ss:Type="Number">${i+1}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.question)}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.answer)}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.subject||'')}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.class||'')}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.chapter||'')}</Data></Cell>
<Cell ${rowStyle}><Data ss:Type="String">${escXml(d.difficulty||'')}</Data></Cell>
</Row>`;
        }
    });
    xml += `</Table></Worksheet></Workbook>`;
    downloadFile(xml, filename+'.xls', 'application/vnd.ms-excel;charset=utf-8');
}

function escXml(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function downloadFile(content, filename, mimeType) {
    let blob = new Blob([content], { type: mimeType });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

// ── Export Modal ──────────────────────────────────────────────────
function showExportModal(qtype) {
    let existing = document.getElementById('export-format-modal');
    if (existing) existing.remove();
    let modal = document.createElement('div');
    modal.id = 'export-format-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:24px;width:90%;max-width:360px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="color:#1e293b;margin:0 0 6px;font-size:18px;">⬇️ Export Format தேர்வு</h3>
        <p style="color:#64748b;font-size:13px;font-weight:700;margin:0 0 18px;">எந்த format-ல் download வேண்டும்?</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <button onclick="exportQuestions('${qtype}','txt');document.getElementById('export-format-modal').remove()"
                style="background:linear-gradient(135deg,#64748b,#475569);box-shadow:0 4px 0 #334155;border-radius:14px;padding:14px;font-size:15px;">
                📄 TXT — Plain Text (6 வரி format)
            </button>
            <button onclick="exportQuestions('${qtype}','csv');document.getElementById('export-format-modal').remove()"
                style="background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 0 #047857;border-radius:14px;padding:14px;font-size:15px;">
                📊 CSV — Spreadsheet compatible
            </button>
            <button onclick="exportQuestions('${qtype}','excel');document.getElementById('export-format-modal').remove()"
                style="background:linear-gradient(135deg,#1d6f42,#15803d);box-shadow:0 4px 0 #14532d;border-radius:14px;padding:14px;font-size:15px;">
                🟩 Excel (.xls) — Colored headers
            </button>
        </div>
        <button onclick="document.getElementById('export-format-modal').remove()"
            style="margin-top:12px;background:#f1f5f9;color:#64748b;box-shadow:0 3px 0 #cbd5e1;border-radius:12px;padding:10px;font-size:14px;">
            ❌ ரத்து
        </button>
    </div>`;
    document.body.appendChild(modal);
}


// ── Duplicate Check in upload (add to uploadSimpleText flow) ──────
async function checkDuplicate(question, subject, cls) {
    let snap = await db.collection('quiz_questions').where('subject','==',subject).where('class','==',cls).where('question','==',question).get().catch(()=>null);
    return snap && !snap.empty;
}

// ── Assignment System ─────────────────────────────────────────────
function setupAssignmentSelects() {
    if(!loggedInTeacher) return;
    let subjectHtml = loggedInTeacher.subject === "அனைத்தும்"
        ? `<option value="தமிழ்">📙 தமிழ்</option><option value="ஆங்கிலம்">📘 ஆங்கிலம்</option><option value="கணிதம்">📐 கணிதம்</option><option value="அறிவியல்">🔬 அறிவியல்</option><option value="சமூக அறிவியல்">🌍 சமூக அறிவியல்</option>`
        : `<option value="${loggedInTeacher.subject}">${loggedInTeacher.subject}</option>`;
    let assignSubj = document.getElementById('assign-subject'); if(assignSubj) assignSubj.innerHTML = subjectHtml;
    let classHtml = '<option value="">வகுப்பு தேர்வு</option>';
    loggedInTeacher.classes.forEach(c => { classHtml += `<option value="${c}">${c} ஆம் வகுப்பு</option>`; });
    let assignCls = document.getElementById('assign-class'); if(assignCls) assignCls.innerHTML = classHtml;
}

async function createAssignment() {
    let cls = (document.getElementById('assign-class')||{}).value;
    let subject = (document.getElementById('assign-subject')||{}).value;
    let title = (document.getElementById('assign-title')||{}).value.trim();
    let due = (document.getElementById('assign-due')||{}).value;
    let statusEl = document.getElementById('assign-status');
    if(!cls||!title||!due) { statusEl.style.color='#ef4444'; statusEl.textContent='அனைத்து விவரங்களையும் நிரப்பவும்!'; return; }
    statusEl.textContent='அனுப்பப்படுகிறது...';
    try {
        await db.collection('assignments').add({
            class: cls, subject, title, dueDate: due,
            assignedBy: loggedInTeacher.name,
            timestamp: new Date().toISOString(),
            completions: []
        });
        statusEl.style.color='#10b981'; statusEl.textContent='✅ Assignment அனுப்பப்பட்டது!';
        logActivity('assign', `${cls} வகுப்புக்கு "${title}" assignment அனுப்பப்பட்டது`);
        document.getElementById('assign-title').value=''; document.getElementById('assign-due').value='';
        setTimeout(()=>{ statusEl.textContent=''; loadAssignments(); }, 1500);
    } catch(e) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ பிழை: '+e.message; }
}

function loadAssignments() {
    let list = document.getElementById('assignment-list'); if(!list) return;
    list.innerHTML = '⏳';
    let query = db.collection('assignments').orderBy('timestamp','desc').limit(20);
    query.get().then(snap => {
        list.innerHTML = '';
        if(snap.empty) { list.innerHTML='<p style="color:#94a3b8;font-weight:700;">Assignments இல்லை.</p>'; return; }
        snap.forEach(doc => {
            let d = doc.data();
            let due = d.dueDate || '—';
            let completions = (d.completions||[]).length;
            let today = new Date().toISOString().slice(0,10);
            let expired = due < today;
            list.innerHTML += `<div style="border:2px solid ${expired?'#fca5a5':'#86efac'};border-radius:14px;padding:12px;margin-bottom:8px;background:${expired?'#fef2f2':'#f0fdf4'};">
                <div style="font-weight:800;font-size:14px;color:#1e293b;">${d.title}</div>
                <div style="font-size:12px;color:#64748b;margin:4px 0;">📚 ${d.subject} | 🏫 ${d.class} வகுப்பு | 📅 ${due} ${expired?'<span style="color:#ef4444;font-weight:800;">(காலாவதி)</span>':''}</div>
                <div style="font-size:12px;color:#10b981;font-weight:800;">✅ ${completions} மாணவர்கள் முடித்தனர்</div>
                <button class="danger-btn" style="margin:6px 0 0 0!important;" onclick="deleteAssignment('${doc.id}')">🗑️ நீக்கு</button>
            </div>`;
        });
    }).catch(() => { list.innerHTML = '<p style="color:#94a3b8;">தரவு இல்லை</p>'; });
}

async function deleteAssignment(id) {
    if(!confirm('இந்த Assignment-ஐ நீக்க வேண்டுமா?')) return;
    await db.collection('assignments').doc(id).delete();
    loadAssignments();
}

// ── Multi-Teacher Settings (Admin only) ──────────────────────────
async function addTeacher() {
    let user = (document.getElementById('new-teacher-user')||{}).value.trim().toLowerCase();
    let pass = (document.getElementById('new-teacher-pass')||{}).value.trim();
    let name = (document.getElementById('new-teacher-name')||{}).value.trim();
    let subject = (document.getElementById('new-teacher-subject')||{}).value;
    let statusEl = document.getElementById('settings-status');
    if(!user||!pass||!name) { statusEl.style.color='#ef4444'; statusEl.textContent='அனைத்து விவரங்களையும் நிரப்பவும்!'; return; }
    // Check duplicate
    let snap = await db.collection('teachers').where('username','==',user).get().catch(()=>null);
    if(snap && !snap.empty) { statusEl.style.color='#ef4444'; statusEl.textContent='இந்த username ஏற்கனவே உள்ளது!'; return; }
    try {
        await db.collection('teachers').add({ username:user, password:pass, name, subject, classes:["1","2","3","4","5","6","7","8","9","10","11","12"], active:true });
        statusEl.style.color='#10b981'; statusEl.textContent='✅ ஆசிரியர் சேர்க்கப்பட்டார்!';
        logActivity('settings', `புதிய ஆசிரியர் சேர்க்கப்பட்டார்: ${name}`);
        ['new-teacher-user','new-teacher-pass','new-teacher-name'].forEach(id => { let el=document.getElementById(id); if(el) el.value=''; });
        setTimeout(()=>{ statusEl.textContent=''; loadTeacherList(); }, 1500);
    } catch(e) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ பிழை: '+e.message; }
}

function loadTeacherList() {
    let list = document.getElementById('teacher-list'); if(!list) return;
    list.innerHTML = '⏳';
    // Show hardcoded teachers
    let hardcoded = Object.entries(TEACHERS_DATA).map(([u,t]) =>
        `<div style="border:2px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:10px;"><span style="font-size:1.5rem;">🧑‍🏫</span><div style="flex:1;"><div style="font-weight:800;font-size:14px;">${t.name}</div><div style="font-size:12px;color:#64748b;">@${u} | ${t.subject}</div></div><span style="font-size:11px;background:#dbeafe;color:#1e40af;padding:3px 8px;border-radius:8px;font-weight:800;">Built-in</span></div>`
    ).join('');
    // Firestore teachers
    db.collection('teachers').get().then(snap => {
        let fsHtml = '';
        snap.forEach(doc => {
            let d = doc.data();
            fsHtml += `<div style="border:2px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:10px;"><span style="font-size:1.5rem;">🧑‍🏫</span><div style="flex:1;"><div style="font-weight:800;font-size:14px;">${d.name}</div><div style="font-size:12px;color:#64748b;">@${d.username} | ${d.subject}</div></div><button class="danger-btn" style="margin:0!important;padding:5px 10px!important;" onclick="removeTeacher('${doc.id}')">🗑️</button></div>`;
        });
        list.innerHTML = hardcoded + (fsHtml || '<p style="color:#94a3b8;font-size:13px;">Firestore ஆசிரியர்கள் இல்லை</p>');
    }).catch(() => { list.innerHTML = hardcoded; });
}

async function removeTeacher(id) {
    if(!confirm('இந்த ஆசிரியரை நீக்க வேண்டுமா?')) return;
    await db.collection('teachers').doc(id).delete();
    logActivity('settings', 'ஆசிரியர் நீக்கப்பட்டார்');
    loadTeacherList();
}

// ── Patch verifyTeacherLogin to check Firestore teachers too ─────
const _origVerifyTeacher = window.verifyTeacherLogin || verifyTeacherLogin;
window.verifyTeacherLogin = function() {
    const user = document.getElementById('teacher-username').value.trim().toLowerCase();
    const pass = document.getElementById('admin-password').value.trim();
    const errorMsg = document.getElementById('pwd-error');
    // Check built-in first
    if (TEACHERS_DATA[user] && TEACHERS_DATA[user].password === pass) {
        loggedInTeacher = TEACHERS_DATA[user];
        errorMsg.classList.add('hidden');
        document.getElementById('teacher-username').value = '';
        document.getElementById('admin-password').value = '';
        setupAdminUI(); showScreen('admin-screen'); switchAdminTab('dashboard');
        return;
    }
    // Check Firestore teachers
    db.collection('teachers').where('username','==',user).where('password','==',pass).get().then(snap => {
        if(!snap.empty) {
            let d = snap.docs[0].data();
            loggedInTeacher = { name:d.name, subject:d.subject, classes:d.classes||["1","2","3","4","5","6","7","8","9","10","11","12"] };
            errorMsg.classList.add('hidden');
            document.getElementById('teacher-username').value = '';
            document.getElementById('admin-password').value = '';
            setupAdminUI(); showScreen('admin-screen'); switchAdminTab('dashboard');
        } else {
            errorMsg.innerText = "தவறான பயனர்பெயர் அல்லது கடவுச்சொல்! ❌";
            errorMsg.classList.remove('hidden');
        }
    }).catch(() => {
        errorMsg.innerText = "தவறான பயனர்பெயர் அல்லது கடவுச்சொல்! ❌";
        errorMsg.classList.remove('hidden');
    });
};

// =================================================================
//  Assignment — Student Side: Load + Auto-complete
// =================================================================

// ── Load pending assignments for the logged-in student ───────────
function loadStudentAssignments() {
    if (!loggedInClass) return;
    let today = new Date().toISOString().slice(0, 10);
    db.collection('assignments')
        .where('class', '==', loggedInClass)
        .get()
        .then(snap => {
            let pending = [];
            snap.forEach(doc => {
                let d = doc.data(); d._id = doc.id;
                let expired = d.dueDate < today;
                let alreadyDone = (d.completions || []).includes(loggedInStudent);
                if (!expired && !alreadyDone) pending.push(d);
            });
            renderAssignmentBanner(pending);
        }).catch(() => {});
}

function renderAssignmentBanner(assignments) {
    let banner = document.getElementById('assignment-banner');
    let list   = document.getElementById('assignment-banner-list');
    if (!banner || !list) return;
    if (!assignments.length) { banner.classList.add('hidden'); return; }
    banner.classList.remove('hidden');
    list.innerHTML = assignments.map(a => {
        let daysLeft = Math.ceil((new Date(a.dueDate) - new Date()) / 86400000);
        let urgency  = daysLeft <= 1 ? '🔴' : daysLeft <= 3 ? '🟠' : '🟢';
        return `<div style="display:flex; align-items:center; justify-content:space-between; background:#fff; border:2px solid #fde68a; border-radius:14px; padding:10px 12px; margin:5px 0; cursor:pointer;"
                    onclick="quickStartAssignment('${a.subject}','${a._id}')">
                    <div>
                        <div style="font-weight:800; font-size:14px; color:#1e293b;">${urgency} ${a.title}</div>
                        <div style="font-size:12px; color:#92400e; margin-top:2px;">📚 ${a.subject} &nbsp;|&nbsp; 📅 ${a.dueDate} &nbsp;|&nbsp; ${daysLeft}நாள் மீதம்</div>
                    </div>
                    <span style="background:#f59e0b; color:#fff; font-size:12px; font-weight:800; padding:5px 10px; border-radius:10px;">Start ▶</span>
                </div>`;
    }).join('');
}

// ── Quick-start quiz from assignment banner ───────────────────────
function quickStartAssignment(subject, assignmentId) {
    // Set the subject dropdown
    let sel = document.getElementById('student-subject-select');
    if (sel) sel.value = subject;
    loadChaptersForStudent();
    // Store active assignment id so we can mark completion later
    window._activeAssignmentId = assignmentId;
    // Jump straight to mode select for MCQ
    window._quizChapter    = 'all';
    window._quizDifficulty = 'all';
    window._quizQCount     = 10;
    window._lastQuizSubject = subject;
    goToModeSelect('mcq');
}

// ── Mark assignment complete after quiz result ────────────────────
function markAssignmentComplete(subject, score, total) {
    if (!window._activeAssignmentId) return;
    let assignId = window._activeAssignmentId;
    window._activeAssignmentId = null; // clear

    db.collection('assignments').doc(assignId).get().then(doc => {
        if (!doc.exists) return;
        let completions = doc.data().completions || [];
        if (completions.includes(loggedInStudent)) return; // already done
        completions.push(loggedInStudent);
        return db.collection('assignments').doc(assignId).update({ completions });
    }).then(() => {
        // Show banner on result screen
        let pct = total > 0 ? Math.round(score / total * 100) : 0;
        let el  = document.getElementById('assignment-completed-banner');
        if (el) {
            el.innerHTML = `✅ Assignment முடித்தீர்கள்! மதிப்பெண்: ${score}/${total} (${pct}%)`;
            el.classList.remove('hidden');
        }
    }).catch(() => {});
}

// ── Hook: loadStudentAssignments when subject-screen shows ────────
(function watchSubjectForAssignments() {
    function watch() {
        let screen = document.getElementById('subject-screen');
        if (!screen) { setTimeout(watch, 400); return; }
        new MutationObserver(mutations => {
            mutations.forEach(m => {
                if (m.attributeName === 'class' && !screen.classList.contains('hidden')) {
                    setTimeout(loadStudentAssignments, 400);
                }
            });
        }).observe(screen, { attributes: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else watch();
})();

// ── Hook: hide assignment-completed-banner on result screen open ──
(function watchResultForAssignment() {
    function watch() {
        let screen = document.getElementById('result-screen');
        if (!screen) { setTimeout(watch, 400); return; }
        new MutationObserver(mutations => {
            mutations.forEach(m => {
                if (m.attributeName === 'class' && !screen.classList.contains('hidden')) {
                    // hide stale banner first, then markAssignmentComplete is called from showMCQResult
                    let el = document.getElementById('assignment-completed-banner');
                    if (el) el.classList.add('hidden');
                }
            });
        }).observe(screen, { attributes: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
    else watch();
})();


// =================================================================
//  AI Tool v2.0 — Upgraded Question Generator
// =================================================================

let _aiGeneratedQuestions = [];
let _pdfBase64Data = null;
let _aiHistory = [];
const AI_HISTORY_KEY = 'ua_ai_history';

// ── Quick topics per subject ──────────────────────────────────────
const QUICK_TOPICS = {
    'தமிழ்':         ['இலக்கணம்','கவிதை','உரைநடை','பழமொழி','திருக்குறள்'],
    'ஆங்கிலம்':      ['Grammar','Poem','Prose','Vocabulary','Tenses'],
    'கணிதம்':        ['எண்கள்','பின்னங்கள்','வடிவியல்','அளவீடு','புள்ளியியல்'],
    'அறிவியல்':      ['விலங்குகள்','தாவரங்கள்','இயற்பியல்','வேதியியல்','மனித உடல்'],
    'சமூக அறிவியல்': ['வரலாறு','புவியியல்','குடிமையியல்','பொருளாதாரம்','இந்தியா']
};

// ── Setup ─────────────────────────────────────────────────────────
function setupAiTab() {
    if (!loggedInTeacher) return;
    let classHtml = '<option value="">வகுப்பு தேர்வு</option>';
    loggedInTeacher.classes.forEach(c => { classHtml += `<option value="${c}">${c} ஆம் வகுப்பு</option>`; });
    let aiCls = document.getElementById('ai-class'); if (aiCls) aiCls.innerHTML = classHtml;
    let savedKey = localStorage.getItem('ua_api_key') || '';
    let keyEl = document.getElementById('ai-api-key'); if (keyEl) keyEl.value = savedKey;
    // Char counter
    let ta = document.getElementById('ai-text-input');
    if (ta) ta.oninput = () => { let cc = document.getElementById('ai-char-count'); if (cc) cc.textContent = ta.value.length; };
    // Subject change → update quick topics
    let subj = document.getElementById('ai-subject');
    if (subj) subj.onchange = updateAiQuickTopics;
    updateAiQuickTopics();
    loadAiHistory();
}

function updateAiQuickTopics() {
    let subj = (document.getElementById('ai-subject') || {}).value || 'தமிழ்';
    let topics = QUICK_TOPICS[subj] || [];
    let container = document.getElementById('ai-quick-topics');
    if (!container) return;
    container.innerHTML = topics.map(t =>
        `<button onclick="setAiTopic('${t}')" style="width:auto;padding:4px 10px;font-size:11px;margin:0;background:#e0e7ff;color:#4f46e5;box-shadow:0 2px 0 #c7d2fe;border-radius:8px;">${t}</button>`
    ).join('');
}

function setAiTopic(topic) {
    let el = document.getElementById('ai-chapter'); if (el) el.value = topic;
    switchAiTab('topic');
}

function updateAiTypeUI() {
    // Mix mode: double the count
    let qtype = (document.getElementById('ai-qtype') || {}).value;
    let countEl = document.getElementById('ai-qcount');
    if (qtype === 'both' && countEl && parseInt(countEl.value) < 4) countEl.value = 6;
}

function saveApiKey() {
    let k = (document.getElementById('ai-api-key') || {}).value || '';
    localStorage.setItem('ua_api_key', k);
}
function toggleApiKeyVisibility() {
    let el = document.getElementById('ai-api-key');
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

function switchAiTab(tab) {
    ['text','pdf','topic','history'].forEach(t => {
        let panel = document.getElementById('ai-' + t + '-panel');
        let btn   = document.getElementById('ai-tab-' + t);
        if (panel) panel.classList.toggle('hidden', t !== tab);
        if (btn) {
            btn.style.background   = t === tab ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#94a3b8';
            btn.style.boxShadow    = t === tab ? '0 3px 0 #3730a3' : '0 3px 0 #64748b';
        }
    });
    if (tab === 'history') loadAiHistory();
}

// ── PDF ───────────────────────────────────────────────────────────
function handlePdfDrop(e) {
    e.preventDefault();
    document.getElementById('pdf-drop-zone').classList.remove('dragover');
    let file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') processPdfFile(file);
    else alert('PDF file மட்டும் ஏற்றுக்கொள்ளப்படும்!');
}
function handlePdfFile(e) { if (e.target.files[0]) processPdfFile(e.target.files[0]); }
function processPdfFile(file) {
    if (file.size > 10 * 1024 * 1024) { alert('10MB-க்கும் அதிகமான file ஏற்றுக்கொள்ள முடியாது!'); return; }
    let reader = new FileReader();
    reader.onload = e => {
        _pdfBase64Data = e.target.result.split(',')[1];
        let dz = document.getElementById('pdf-drop-zone');
        if (dz) dz.innerHTML = `<div style="font-size:1.8rem;">✅</div><p style="font-weight:800;color:#166534;margin:3px 0;font-size:13px;">${file.name}</p><p style="font-size:11px;color:#64748b;margin:0;">${(file.size/1024).toFixed(0)} KB — தயார்!</p>`;
    };
    reader.readAsDataURL(file);
}

// ── Progress helpers ──────────────────────────────────────────────
function setAiProgress(pct, msg) {
    let wrap = document.getElementById('ai-progress-wrap');
    let bar  = document.getElementById('ai-progress-bar');
    let st   = document.getElementById('ai-status');
    let si   = document.getElementById('ai-status-inline');
    if (pct >= 0) {
        if (wrap) wrap.classList.remove('hidden');
        if (bar)  bar.style.width = pct + '%';
        if (st)   { st.style.color = '#6366f1'; st.innerHTML = msg; }
        if (si)   si.textContent = '';
    } else {
        if (wrap) wrap.classList.add('hidden');
        if (si)   { si.style.color = '#ef4444'; si.textContent = msg; }
        if (st)   st.textContent = '';
    }
}

// ── Main Generator ────────────────────────────────────────────────
async function generateAIQuestions() {
    let apiKey  = (document.getElementById('ai-api-key') || {}).value.trim();
    let cls     = (document.getElementById('ai-class') || {}).value;
    let subject = (document.getElementById('ai-subject') || {}).value;
    let chapter = (document.getElementById('ai-chapter') || {}).value.trim();
    let qtype   = (document.getElementById('ai-qtype') || {}).value;
    let qcount  = Math.min(parseInt((document.getElementById('ai-qcount') || {}).value) || 5, 20);
    let diff    = (document.getElementById('ai-difficulty') || {}).value;
    let lang    = (document.getElementById('ai-lang') || {}).value || 'tamil';
    let isPdfMode   = !document.getElementById('ai-pdf-panel').classList.contains('hidden');
    let isTopicMode = !document.getElementById('ai-topic-panel').classList.contains('hidden');
    let textInput   = (document.getElementById('ai-text-input') || {}).value.trim().substring(0, 3000);

    if (!apiKey) { setAiProgress(-1, '⚠️ API Key தேவை!'); return; }
    if (!apiKey.startsWith('sk-or-')) { setAiProgress(-1, '⚠️ Key தவறு! sk-or-v1-... format வேண்டும்'); return; }
    if (!cls)   { setAiProgress(-1, '⚠️ வகுப்பு தேர்வு செய்யவும்!'); return; }
    if (isPdfMode && !_pdfBase64Data) { setAiProgress(-1, '⚠️ PDF upload செய்யவும்!'); return; }
    if (!isPdfMode && !isTopicMode && !textInput) { setAiProgress(-1, '⚠️ Content / Topic தேவை!'); return; }
    if (!isPdfMode && !isTopicMode && !chapter && !textInput) { setAiProgress(-1, '⚠️ Chapter அல்லது Text தேவை!'); return; }

    document.getElementById('ai-generate-btn').disabled = true;
    document.getElementById('ai-output-section').classList.add('hidden');
    setAiProgress(10, '🤖 AI தயார் ஆகிறது...');

    // Language instruction
    let langInstr = lang === 'tamil' ? 'Write ALL questions and answers in Tamil language only.'
        : lang === 'english' ? 'Write ALL questions and answers in English only.'
        : 'Write questions in Tamil, but include English translation in brackets.';

    // Build prompt per type
    let allQuestions = [];
    let typesToGenerate = qtype === 'both' ? ['mcq','desc'] : [qtype];
    let perTypeCount   = qtype === 'both' ? Math.max(3, Math.floor(qcount/2)) : qcount;

    for (let [idx, currentType] of typesToGenerate.entries()) {
        setAiProgress(20 + idx * 30, `⚙️ ${currentType === 'mcq' ? 'MCQ' : '2/5 மார்க்'} கேள்விகள் உருவாக்குகிறது...`);

        let diffLabel = {'easy':'easy','medium':'medium','hard':'challenging'}[diff];
        let systemPrompt = currentType === 'mcq'
            ? `You are a Tamil Nadu school teacher for class ${cls}, subject: ${subject}${chapter ? ', topic: '+chapter : ''}.
Generate exactly ${perTypeCount} ${diffLabel} MCQ questions. ${langInstr}
FORMAT (exactly, repeat ${perTypeCount} times):
QUESTION: <question text>
A: <option>
B: <option>
C: <option>
D: <option>
ANSWER: <exact text of correct option>
---
No extra text, no numbering, no explanations.`
            : `You are a Tamil Nadu school teacher for class ${cls}, subject: ${subject}${chapter ? ', topic: '+chapter : ''}.
Generate exactly ${perTypeCount} ${diffLabel} questions with answers. ${langInstr}
FORMAT (exactly, repeat ${perTypeCount} times):
QUESTION: <question>
ANSWER: <concise 2-3 line answer>
---
No extra text, no numbering.`;

        let userMsg = isPdfMode
            ? `Generate ${perTypeCount} ${currentType} questions from this content for ${subject} class ${cls}.`
            : isTopicMode || !textInput
            ? `Generate ${perTypeCount} ${currentType} questions about "${chapter || subject}" for class ${cls} ${subject}.`
            : `Generate questions from this content:\n\n${textInput}`;

        // Model fallback
        let selectedModel = (document.getElementById('ai-model') || {}).value || 'openrouter/free';
        const FREE_MODELS = [
            'nvidia/llama-3.1-nemotron-nano-8b-v1:free',
            'qwen/qwen3-8b:free',
            'meta-llama/llama-4-scout:free',
            'meta-llama/llama-4-maverick:free',
            'mistralai/mistral-small-3.1-24b-instruct:free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'deepseek/deepseek-chat-v3-0324:free',
            'deepseek/deepseek-r1:free',
            'qwen/qwen3-235b-a22b:free',
            'openrouter/free'
        ];
        let modelsToTry = selectedModel === 'openrouter/free' ? FREE_MODELS : [selectedModel, ...FREE_MODELS];

        let raw = '', lastErr = '';
        for (let model of modelsToTry) {
            setAiProgress(30 + idx * 30, `🔄 ${model.split('/')[1].split(':')[0]} try செய்கிறது...`);
            try {
                let body = {
                    model,
                    messages: [{ role:'system', content: systemPrompt }, { role:'user', content: userMsg }],
                    max_tokens: Math.min(perTypeCount * (currentType === 'mcq' ? 160 : 200), 2500),
                    temperature: 0.5
                };
                if (isPdfMode && _pdfBase64Data) {
                    body.messages[1].content = [
                        { type:'image_url', image_url:{ url:`data:application/pdf;base64,${_pdfBase64Data.substring(0,1000)}` } },
                        { type:'text', text: userMsg }
                    ];
                }
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 20000);
                const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method:'POST', signal: controller.signal,
                    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${apiKey}`, 'HTTP-Referer': window.location.href, 'X-Title':'Ungal Aasiriyar' },
                    body: JSON.stringify(body)
                });
                clearTimeout(timeout);
                const data = await resp.json();
                if (data.error) {
                    let msg = data.error.message || '';
                    if (msg.includes('No endpoints') || msg.includes('not found') || msg.includes('Provider returned error')) { lastErr = msg; continue; }
                    if (msg.includes('User not found')) throw new Error('API Key தவறானது!');
                    throw new Error(msg);
                }
                raw = ((data.choices || [])[0]?.message?.content || '').trim();
                if (raw) break;
            } catch(e) {
                if (e.message === 'API Key தவறானது!') throw e;
                if (e.name === 'AbortError') { lastErr = 'Timeout'; continue; }
                lastErr = e.message;
            }
        }
        if (!raw) throw new Error(`பிழை: ${lastErr}`);
        let parsed = parseAIOutput(raw, currentType, subject, cls, chapter, diff);
        allQuestions = allQuestions.concat(parsed);
    }

    if (!allQuestions.length) throw new Error('கேள்விகள் parse ஆகவில்லை. மீண்டும் try செய்யவும்.');

    _aiGeneratedQuestions = allQuestions.map((q,i) => ({ ...q, _selected: true, _id: i }));
    setAiProgress(100, `✅ ${_aiGeneratedQuestions.length} கேள்விகள் தயார்!`);
    renderAIPreview(_aiGeneratedQuestions);
    document.getElementById('ai-output-section').classList.remove('hidden');
    saveToAiHistory(_aiGeneratedQuestions, subject, cls, chapter);
    setTimeout(() => { let w = document.getElementById('ai-progress-wrap'); if(w) w.classList.add('hidden'); }, 2000);
    document.getElementById('ai-generate-btn').disabled = false;
}

// ── Parse ─────────────────────────────────────────────────────────
function parseAIOutput(raw, qtype, subject, cls, chapter, diff) {
    // Clean markdown
    raw = raw.replace(/```[\s\S]*?```/g, '').replace(/\*\*/g, '').replace(/#{1,4}/g,'');
    let blocks = raw.split(/---+/).map(b => b.trim()).filter(Boolean);
    let questions = [];
    blocks.forEach(block => {
        let lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        let qLine = lines.find(l => /^QUESTION:/i.test(l));
        let aLine = lines.find(l => /^ANSWER:/i.test(l));
        if (!qLine) return;
        let question = qLine.replace(/^QUESTION:\s*/i,'').trim();
        let answer   = aLine ? aLine.replace(/^ANSWER:\s*/i,'').trim() : '';
        if (!question || !answer) return;
        if (qtype === 'mcq') {
            let opts = ['A','B','C','D'].map(p => {
                let l = lines.find(l => new RegExp('^'+p+'[:\\.]','i').test(l));
                return l ? l.replace(new RegExp('^'+p+'[:\\.\\s]*','i'),'').trim() : '';
            }).filter(Boolean);
            if (opts.length < 2) return; // need at least 2 options
            // Pad to 4 if needed
            while (opts.length < 4) opts.push(opts[0]);
            opts = opts.slice(0,4);
            // Fix answer match
            if (!opts.includes(answer)) {
                let m = opts.find(o => o.toLowerCase().includes(answer.toLowerCase()) || answer.toLowerCase().includes(o.toLowerCase()));
                if (m) answer = m; else answer = opts[0];
            }
            questions.push({ question, options: opts, answer, subject, class: cls, chapter, difficulty: diff, type: 'mcq', _selected: true });
        } else {
            questions.push({ question, answer, subject, class: cls, chapter, difficulty: diff, type: 'desc', _selected: true });
        }
    });
    return questions;
}

// ── Render Preview (editable) ─────────────────────────────────────
function renderAIPreview(questions) {
    let badge = document.getElementById('ai-q-count-badge');
    let selectedCount = questions.filter(q => q._selected).length;
    if (badge) badge.textContent = `${selectedCount}/${questions.length} selected`;

    let html = questions.map((q, i) => {
        let isMCQ = q.type === 'mcq';
        let optsHtml = isMCQ && q.options
            ? q.options.map((o, oi) => `
                <div style="display:flex;align-items:center;gap:4px;margin:3px 0;">
                    <span style="font-size:11px;font-weight:900;color:#6366f1;min-width:16px;">${['A','B','C','D'][oi]}:</span>
                    <input type="text" value="${o.replace(/"/g,'&quot;')}" onchange="_aiGeneratedQuestions[${i}].options[${oi}]=this.value;syncAnsOption(${i})"
                        style="flex:1;padding:4px 8px;font-size:12px;margin:0;border-radius:8px;border:1.5px solid ${o===q.answer?'#10b981':'#e2e8f0'};background:${o===q.answer?'#d1fae5':'#f8fafc'};">
                </div>`).join('')
            : '';
        return `<div class="ai-q-card" id="ai-card-${i}" style="opacity:${q._selected?1:0.45};border-color:${q._selected?'#6366f1':'#e2e8f0'};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span class="q-num">${i+1}. ${q.type==='mcq'?'🎯 MCQ':'📝 Desc'} | ${q.difficulty}</span>
                <div style="display:flex;gap:4px;">
                    <button onclick="toggleAiQ(${i})" style="width:28px;height:28px;padding:0;font-size:13px;margin:0;background:${q._selected?'#6366f1':'#e2e8f0'};box-shadow:none;border-radius:8px;">${q._selected?'✓':'○'}</button>
                    <button onclick="deleteAiQ(${i})" style="width:28px;height:28px;padding:0;font-size:13px;margin:0;background:#fee2e2;color:#dc2626;box-shadow:none;border-radius:8px;">🗑</button>
                </div>
            </div>
            <textarea onchange="_aiGeneratedQuestions[${i}].question=this.value" rows="2"
                style="width:100%;font-size:13px;font-weight:700;padding:6px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;resize:vertical;font-family:Nunito,sans-serif;">${q.question.replace(/</g,'&lt;')}</textarea>
            ${optsHtml}
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <span style="font-size:11px;font-weight:900;color:#10b981;white-space:nowrap;">✅ விடை:</span>
                <input type="text" value="${q.answer.replace(/"/g,'&quot;')}" onchange="_aiGeneratedQuestions[${i}].answer=this.value"
                    style="flex:1;padding:5px 8px;font-size:12px;font-weight:700;margin:0;border-radius:8px;border:1.5px solid #10b981;background:#f0fdf4;">
            </div>
        </div>`;
    }).join('');
    let preview = document.getElementById('ai-questions-preview');
    if (preview) preview.innerHTML = html || '<p style="color:#94a3b8;font-weight:700;">கேள்விகள் இல்லை.</p>';
}

function toggleAiQ(i) {
    if (_aiGeneratedQuestions[i]) {
        _aiGeneratedQuestions[i]._selected = !_aiGeneratedQuestions[i]._selected;
        renderAIPreview(_aiGeneratedQuestions);
    }
}
function deleteAiQ(i) {
    _aiGeneratedQuestions.splice(i, 1);
    renderAIPreview(_aiGeneratedQuestions);
}
function selectAllAIQuestions(val) {
    _aiGeneratedQuestions.forEach(q => q._selected = val);
    renderAIPreview(_aiGeneratedQuestions);
}
function syncAnsOption(i) {
    // After editing options, check if answer still matches
    let q = _aiGeneratedQuestions[i];
    if (q && q.type === 'mcq' && !q.options.includes(q.answer)) q.answer = q.options[0] || '';
    renderAIPreview(_aiGeneratedQuestions);
}

// ── Upload ────────────────────────────────────────────────────────
async function uploadAIQuestions() {
    let toUpload = _aiGeneratedQuestions.filter(q => q._selected);
    if (!toUpload.length) { alert('தேர்ந்தெடுக்கப்பட்ட கேள்விகள் இல்லை!'); return; }
    let statusEl = document.getElementById('ai-upload-status');
    let progWrap = document.getElementById('ai-upload-progress-wrap');
    let progBar  = document.getElementById('ai-upload-bar');
    statusEl.style.color = '#6366f1'; statusEl.textContent = 'Upload ஆகிறது...';
    if (progWrap) progWrap.classList.remove('hidden');

    try {
        // Split by type
        let mcqs  = toUpload.filter(q => q.type === 'mcq');
        let descs = toUpload.filter(q => q.type === 'desc');
        let total = toUpload.length, done = 0;

        for (let [questions, col] of [[mcqs,'quiz_questions'],[descs,'desc_questions']]) {
            if (!questions.length) continue;
            let batch = db.batch();
            questions.forEach(q => {
                let docRef = db.collection(col).doc();
                let data = { subject:q.subject, class:q.class, type:q.type, question:q.question, answer:q.answer, chapter:q.chapter||'', difficulty:q.difficulty||'medium', aiGenerated:true };
                if (q.type === 'mcq') data.options = q.options;
                batch.set(docRef, data);
            });
            await batch.commit();
            done += questions.length;
            if (progBar) progBar.style.width = Math.round(done/total*100) + '%';
        }
        statusEl.style.color = '#10b981';
        statusEl.textContent = `✅ ${done} கேள்விகள் upload ஆனது!`;
        logActivity('upload', `AI மூலம் ${done} கேள்விகள் (${mcqs.length} MCQ, ${descs.length} Desc) upload செய்யப்பட்டன`);
        _aiGeneratedQuestions = [];
        setTimeout(() => {
            statusEl.textContent = '';
            if (progWrap) progWrap.classList.add('hidden');
            document.getElementById('ai-output-section').classList.add('hidden');
        }, 3000);
    } catch(e) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = '❌ பிழை: ' + e.message;
        if (progWrap) progWrap.classList.add('hidden');
    }
}

// ── Copy All ──────────────────────────────────────────────────────
function copyAllToText() {
    let text = _aiGeneratedQuestions.filter(q => q._selected).map((q,i) => {
        if (q.type === 'mcq') return `${i+1}. ${q.question}\n${(q.options||[]).join('\n')}\nAnswer: ${q.answer}`;
        return `${i+1}. ${q.question}\nAnswer: ${q.answer}`;
    }).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => {
        let btn = document.querySelector('button[onclick="copyAllToText()"]');
        if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => btn.textContent = '📋 Copy', 2000); }
    }).catch(() => alert('Copy failed'));
}

// ── History ───────────────────────────────────────────────────────
function saveToAiHistory(questions, subject, cls, chapter) {
    try {
        let history = JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]');
        history.unshift({
            id: Date.now(),
            subject, cls, chapter,
            count: questions.length,
            mcq: questions.filter(q => q.type === 'mcq').length,
            desc: questions.filter(q => q.type === 'desc').length,
            date: new Date().toLocaleDateString('ta-IN'),
            questions: questions.slice(0, 20) // store max 20
        });
        history = history.slice(0, 10); // keep last 10
        localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(history));
    } catch(e) {}
}

function loadAiHistory() {
    let listEl = document.getElementById('ai-history-list');
    if (!listEl) return;
    try {
        let history = JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]');
        if (!history.length) { listEl.innerHTML = '<p style="color:#94a3b8;font-weight:700;text-align:center;padding:15px;">வரலாறு இல்லை</p>'; return; }
        listEl.innerHTML = history.map(h =>
            `<div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin:5px 0;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="restoreHistory(${h.id})">
                <div>
                    <div style="font-weight:800;font-size:13px;color:#1e293b;">${h.subject} — ${h.cls} வகுப்பு${h.chapter?' | '+h.chapter:''}</div>
                    <div style="font-size:11px;color:#64748b;font-weight:700;margin-top:2px;">🎯 ${h.mcq} MCQ &nbsp;📝 ${h.desc} Desc &nbsp;📅 ${h.date}</div>
                </div>
                <button style="width:auto;padding:5px 10px;font-size:12px;margin:0;background:#6366f1;box-shadow:0 2px 0 #4f46e5;border-radius:8px;" onclick="event.stopPropagation();restoreHistory(${h.id})">불러오기</button>
            </div>`
        ).join('');
    } catch(e) { listEl.innerHTML = '<p style="color:#94a3b8;">வரலாறு load ஆகவில்லை</p>'; }
}

function restoreHistory(id) {
    try {
        let history = JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]');
        let entry = history.find(h => h.id === id);
        if (!entry || !entry.questions) return;
        _aiGeneratedQuestions = entry.questions.map((q,i) => ({ ...q, _selected: true, _id: i }));
        renderAIPreview(_aiGeneratedQuestions);
        document.getElementById('ai-output-section').classList.remove('hidden');
        switchAiTab('text');
    } catch(e) {}
}

function regenerateAI() {
    document.getElementById('ai-output-section').classList.add('hidden');
    _aiGeneratedQuestions = [];
    generateAIQuestions();
}

// ── Export Scores ─────────────────────────────────────────────────
function exportScores() {
    let filterSubject = (document.getElementById('score-filter') || {}).value || '';
    let filterClass   = (document.getElementById('score-class-filter') || {}).value || '';

    let existing = document.getElementById('export-format-modal');
    if (existing) existing.remove();
    let modal = document.createElement('div');
    modal.id = 'export-format-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
    <div style="background:#fff;border-radius:24px;padding:24px;width:90%;max-width:360px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <h3 style="color:#1e293b;margin:0 0 6px;font-size:18px;">⬇️ Scores Export</h3>
        <p style="color:#64748b;font-size:13px;font-weight:700;margin:0 0 18px;">${filterSubject||'அனைத்து பாடம்'} | ${filterClass||'அனைத்து வகுப்பு'}</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <button onclick="doExportScores('csv');document.getElementById('export-format-modal').remove()"
                style="background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 0 #047857;border-radius:14px;padding:14px;font-size:15px;">
                📊 CSV — Excel/Sheets compatible
            </button>
            <button onclick="doExportScores('excel');document.getElementById('export-format-modal').remove()"
                style="background:linear-gradient(135deg,#1d6f42,#15803d);box-shadow:0 4px 0 #14532d;border-radius:14px;padding:14px;font-size:15px;">
                🟩 Excel (.xls) — Colored report
            </button>
            <button onclick="doExportScores('txt');document.getElementById('export-format-modal').remove()"
                style="background:linear-gradient(135deg,#64748b,#475569);box-shadow:0 4px 0 #334155;border-radius:14px;padding:14px;font-size:15px;">
                📄 TXT — Plain text report
            </button>
        </div>
        <button onclick="document.getElementById('export-format-modal').remove()"
            style="margin-top:12px;background:#f1f5f9;color:#64748b;box-shadow:0 3px 0 #cbd5e1;border-radius:12px;padding:10px;font-size:14px;">❌ ரத்து</button>
    </div>`;
    document.body.appendChild(modal);
}

async function doExportScores(format) {
    let filterSubject = (document.getElementById('score-filter') || {}).value || '';
    let filterClass   = (document.getElementById('score-class-filter') || {}).value || '';
    let query = db.collection('quiz_scores').orderBy('timestamp', 'desc');
    const snap = await query.get().catch(e => { alert('பிழை: ' + e.message); return null; });
    if (!snap) return;

    let rows = [];
    snap.forEach(doc => {
        let d = doc.data();
        if (filterSubject && d.subject !== filterSubject) return;
        if (filterClass && d.studentClass !== filterClass) return;
        rows.push(d);
    });

    if (!rows.length) { alert('Export ஆக records இல்லை!'); return; }

    // Sort by score %
    rows.sort((a,b) => (b.score/b.total) - (a.score/a.total));

    let fname = `scores_${filterSubject||'all'}_${filterClass||'all'}`;

    if (format === 'txt') {
        let text = `மதிப்பெண் அறிக்கை\n${'='.repeat(40)}\n`;
        text += `பாடம்: ${filterSubject||'அனைத்தும்'} | வகுப்பு: ${filterClass||'அனைத்தும்'}\nமொத்தம்: ${rows.length} பதிவுகள்\n${'='.repeat(40)}\n\n`;
        rows.forEach((d,i) => {
            let pct = d.total > 0 ? Math.round(d.score/d.total*100) : 0;
            let medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':' ';
            text += `${medal} ${i+1}. ${d.studentName} (${d.studentClass} வகுப்பு)\n   ${d.subject}: ${d.score}/${d.total} (${pct}%) — ${(d.timestamp||'').substring(0,10)}\n\n`;
        });
        downloadFile(text, fname+'.txt', 'text/plain;charset=utf-8');

    } else if (format === 'csv') {
        let csvRows = [['#','பெயர்','வகுப்பு','பாடம்','Score','Total','%','தேதி']];
        rows.forEach((d,i) => {
            let pct = d.total > 0 ? Math.round(d.score/d.total*100) : 0;
            csvRows.push([i+1, d.studentName, d.studentClass, d.subject, d.score, d.total, pct+'%', (d.timestamp||'').substring(0,10)]);
        });
        let csv = '\uFEFF' + csvRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
        downloadFile(csv, fname+'.csv', 'text/csv;charset=utf-8');

    } else if (format === 'excel') {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="1"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="12"/><Interior ss:Color="#4f46e5" ss:Pattern="Solid"/></Style>
 <Style ss:ID="2"><Interior ss:Color="#d1fae5" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#065f46"/></Style>
 <Style ss:ID="3"><Interior ss:Color="#fee2e2" ss:Pattern="Solid"/><Font ss:Color="#dc2626"/></Style>
 <Style ss:ID="4"><Interior ss:Color="#fef3c7" ss:Pattern="Solid"/></Style>
 <Style ss:ID="5"><Interior ss:Color="#f0f9ff" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="Scores">
<Table>
<Column ss:Width="40"/><Column ss:Width="120"/><Column ss:Width="70"/><Column ss:Width="120"/>
<Column ss:Width="60"/><Column ss:Width="60"/><Column ss:Width="60"/><Column ss:Width="90"/>
<Row>
${['#','மாணவர் பெயர்','வகுப்பு','பாடம்','Score','Total','%','தேதி'].map(h=>`<Cell s="1"><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('')}
</Row>`;
        rows.forEach((d,i) => {
            let pct = d.total > 0 ? Math.round(d.score/d.total*100) : 0;
            let rowStyle = pct >= 80 ? '2' : pct >= 50 ? '5' : '3';
            let cells = [i+1, d.studentName, d.studentClass, d.subject, d.score, d.total, pct+'%', (d.timestamp||'').substring(0,10)];
            xml += `<Row>${cells.map((c,ci)=>`<Cell s="${ci===0?'4':rowStyle}"><Data ss:Type="${ci===0||ci===4||ci===5?'Number':'String'}">${escXml(c)}</Data></Cell>`).join('')}</Row>\n`;
        });
        xml += '</Table></Worksheet></Workbook>';
        downloadFile(xml, fname+'.xls', 'application/vnd.ms-excel;charset=utf-8');
    }

    logActivity('export', `Scores ${format.toUpperCase()} export — ${rows.length} records`);
}

// =================================================================
//  File Import v2.0 — CSV, Excel, PDF
// =================================================================

let _parsedImportQuestions = { csv: [], excel: [] };

// ── File Sub-tab Switch ───────────────────────────────────────────
function switchFileTab(tab) {
    ['txt','csv','excel','pdf'].forEach(t => {
        let p = document.getElementById('fimp-' + t + '-panel');
        let b = document.getElementById('fimp-tab-' + t);
        if (p) p.classList.toggle('hidden', t !== tab);
        if (b) {
            let active = t === tab;
            let colors = { txt:'#475569,#334155', csv:'#059669,#047857', excel:'#15803d,#14532d', pdf:'#d97706,#b45309' };
            let [bg, sh] = (colors[t]||'#94a3b8,#64748b').split(',');
            b.style.background = active ? `linear-gradient(135deg,${bg},${sh})` : '#94a3b8';
            b.style.boxShadow  = active ? `0 2px 0 ${sh}` : '0 2px 0 #64748b';
        }
    });
}

// ── Shared preview renderer ───────────────────────────────────────
function renderImportPreview(questions, containerId, uploadBtnId, source) {
    _parsedImportQuestions[source] = questions;
    let container  = document.getElementById(containerId);
    let actionRow  = document.getElementById(source + '-action-row');
    let statusEl   = document.getElementById('mcq-file-status');
    let uploadStat = document.getElementById('file-import-upload-status');

    if (uploadStat) uploadStat.textContent = '';

    if (!questions.length) {
        if (container)  container.classList.add('hidden');
        if (actionRow)  actionRow.classList.add('hidden');
        if (statusEl)   { statusEl.style.color='#ef4444'; statusEl.textContent='❌ கேள்விகள் இல்லை!'; }
        return;
    }

    let validQ  = questions.filter(q => !q._error);
    let errorQ  = questions.filter(q => q._error);

    // Status badge
    if (statusEl) {
        statusEl.style.color = validQ.length > 0 ? '#10b981' : '#ef4444';
        statusEl.textContent = `✅ ${validQ.length} valid${errorQ.length ? ' | ❌ ' + errorQ.length + ' errors' : ''} — Upload செய்யவும்`;
    }

    let html = `<div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:10px;padding:8px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:900;color:#1e40af;font-size:13px;">📥 ${questions.length} கேள்விகள் parse ஆனது</span>
        <span style="font-size:11px;color:#64748b;font-weight:700;">✅ ${validQ.length} valid${errorQ.length?' | ❌ '+errorQ.length+' err':''}</span>
    </div>`;

    questions.slice(0, 10).forEach((q, i) => {
        let hasErr = !!q._error;
        html += `<div style="border:2px solid ${hasErr?'#fca5a5':'#e2e8f0'};border-radius:10px;padding:8px 10px;margin:4px 0;background:${hasErr?'#fff5f5':'#fafafa'};">
            <div style="font-size:12px;font-weight:800;color:${hasErr?'#dc2626':'#1e293b'};margin-bottom:${q.options?'4px':'0'};">${i+1}. ${q.question||''}${hasErr?`<span style="color:#ef4444;font-size:11px;"> ⚠️ ${q._error}</span>`:''}</div>
            ${q.options ? `<div style="display:flex;flex-wrap:wrap;gap:3px;">${(q.options||[]).map((o,oi)=>`<span style="padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;background:${o===q.answer?'#d1fae5':'#f1f5f9'};border:1px solid ${o===q.answer?'#10b981':'#e2e8f0'};color:${o===q.answer?'#065f46':'#475569'};">${['A','B','C','D'][oi]}: ${o}</span>`).join('')}</div>` : `<div style="font-size:11px;color:#10b981;font-weight:800;">✅ ${q.answer}</div>`}
        </div>`;
    });
    if (questions.length > 10) {
        html += `<p style="font-size:11px;color:#6366f1;font-weight:800;text-align:center;padding:6px;background:#eff6ff;border-radius:8px;">... ${questions.length-10} more கேள்விகள்</p>`;
    }

    if (container) { container.innerHTML = html; container.classList.remove('hidden'); }
    if (actionRow) actionRow.classList.remove('hidden');
}

// ── Clear File Import panels ──────────────────────────────────────
function clearFileImport(type) {
    _parsedImportQuestions[type] = [];
    let statusEl   = document.getElementById('mcq-file-status');
    let uploadStat = document.getElementById('file-import-upload-status');
    if (statusEl)   statusEl.textContent = '';
    if (uploadStat) uploadStat.textContent = '';

    if (type === 'txt') {
        // Reset TXT drop zone
        let dz = document.getElementById('mcq-file-drop');
        if (dz) dz.innerHTML = '<div style="font-size:2rem;margin-bottom:5px;">📄</div><p style="font-weight:800;color:#475569;margin:0;font-size:13px;">.txt drag & drop அல்லது click</p><p style="font-size:11px;color:#94a3b8;margin:3px 0 0;font-weight:700;">6-வரி format | UTF-8</p>';
        let fi = document.getElementById('mcq-file-input'); if (fi) fi.value = '';
        // Also clear bulk textarea
        let ta = document.getElementById('simple-text'); if (ta) { ta.value = ''; livePreviewMCQ(); }
    } else if (type === 'csv') {
        let dz = document.getElementById('csv-drop-zone');
        if (dz) dz.innerHTML = '<div style="font-size:2rem;margin-bottom:5px;">📊</div><p style="font-weight:800;color:#475569;margin:0;font-size:13px;">.csv drag & drop அல்லது click</p><p style="font-size:11px;color:#94a3b8;margin:3px 0 0;font-weight:700;">UTF-8 | Header row required</p>';
        let fi = document.getElementById('csv-file-input'); if (fi) fi.value = '';
        let pv = document.getElementById('csv-preview'); if (pv) { pv.innerHTML = ''; pv.classList.add('hidden'); }
        let ar = document.getElementById('csv-action-row'); if (ar) ar.classList.add('hidden');
    } else if (type === 'excel') {
        let dz = document.getElementById('excel-drop-zone');
        if (dz) dz.innerHTML = '<div style="font-size:2rem;margin-bottom:5px;">🟩</div><p style="font-weight:800;color:#475569;margin:0;font-size:13px;">.xlsx / .xls drag & drop அல்லது click</p><p style="font-size:11px;color:#94a3b8;margin:3px 0 0;font-weight:700;">SheetJS powered | Multi-sheet support</p>';
        let fi = document.getElementById('excel-file-input'); if (fi) fi.value = '';
        let pv = document.getElementById('excel-preview'); if (pv) { pv.innerHTML = ''; pv.classList.add('hidden'); }
        let ar = document.getElementById('excel-action-row'); if (ar) ar.classList.add('hidden');
    } else if (type === 'pdf') {
        let dz = document.getElementById('mcq-pdf-drop-zone');
        if (dz) dz.innerHTML = '<div style="font-size:2rem;margin-bottom:5px;">📕</div><p style="font-weight:800;color:#475569;margin:0;font-size:13px;">.pdf drag & drop அல்லது click</p><p style="font-size:11px;color:#94a3b8;margin:3px 0 0;font-weight:700;">Max 10MB | Text extract ஆகும்</p>';
        let fi = document.getElementById('mcq-pdf-input'); if (fi) fi.value = '';
        let pv = document.getElementById('pdf-extract-preview'); if (pv) { pv.textContent = ''; pv.classList.add('hidden'); }
        let ar = document.getElementById('pdf-action-row'); if (ar) ar.classList.add('hidden');
        window._mcqPdfBase64 = null; window._mcqPdfText = null; window._mcqPdfName = null;
    }
}

// ── CSV Import ────────────────────────────────────────────────────
function handleCsvDrop(e) {
    e.preventDefault();
    document.getElementById('csv-drop-zone').classList.remove('dragover');
    let file = e.dataTransfer.files[0];
    if (file) parseCsvFile(file);
}
function handleCsvSelect(e) { if (e.target.files[0]) parseCsvFile(e.target.files[0]); }

function parseCsvFile(file) {
    let statusEl = document.getElementById('mcq-file-status');
    statusEl.style.color = '#6366f1'; statusEl.textContent = '⏳ CSV படிக்கப்படுகிறது...';
    let reader = new FileReader();
    reader.onload = e => {
        try {
            let text = e.target.result;
            // Remove BOM
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            let rows = text.split(/\r?\n/).filter(r => r.trim());
            if (rows.length < 2) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ Header + கனைந்தது 1 row தேவை!'; return; }

            // Parse header
            let headers = parseCSVRow(rows[0]).map(h => h.trim().toLowerCase());
            let qIdx = headers.findIndex(h => h.includes('question') || h.includes('கேள்வி') || h === 'q');
            let aIdx = headers.findIndex(h => h.includes('answer') || h.includes('விடை') || h === 'ans');
            let oAIdx = headers.findIndex(h => h === 'optiona' || h === 'option a' || h === 'a' || h.includes('opt1'));
            let oBIdx = headers.findIndex(h => h === 'optionb' || h === 'option b' || h === 'b' || h.includes('opt2'));
            let oCIdx = headers.findIndex(h => h === 'optionc' || h === 'option c' || h === 'c' || h.includes('opt3'));
            let oDIdx = headers.findIndex(h => h === 'optiond' || h === 'option d' || h === 'd' || h.includes('opt4'));

            if (qIdx < 0 || aIdx < 0) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ Question & Answer columns கண்டுபிடிக்க முடியவில்லை! Header சரிபார்க்கவும்.'; return; }

            let questions = [];
            let cls = document.getElementById('bulk-class').value || '';
            let subject = document.getElementById('bulk-subject').value || '';
            let chapter = (document.getElementById('bulk-chapter') || {}).value || '';
            let diff    = (document.getElementById('bulk-difficulty') || {}).value || 'medium';

            for (let i = 1; i < rows.length; i++) {
                let cols = parseCSVRow(rows[i]);
                let question = (cols[qIdx] || '').trim();
                let answer   = (cols[aIdx] || '').trim();
                if (!question) continue;

                let opts = [];
                if (oAIdx >= 0) opts.push((cols[oAIdx]||'').trim());
                if (oBIdx >= 0) opts.push((cols[oBIdx]||'').trim());
                if (oCIdx >= 0) opts.push((cols[oCIdx]||'').trim());
                if (oDIdx >= 0) opts.push((cols[oDIdx]||'').trim());
                opts = opts.filter(Boolean);

                let qObj = { question, answer, subject: cols[headers.findIndex(h=>h.includes('subject'))] || subject, class: cols[headers.findIndex(h=>h.includes('class'))] || cls, chapter: cols[headers.findIndex(h=>h.includes('chapter'))] || chapter, difficulty: cols[headers.findIndex(h=>h.includes('diff'))] || diff, type: 'mcq' };
                if (opts.length >= 2) {
                    qObj.options = opts.length === 4 ? opts : [...opts, ...Array(4-opts.length).fill(opts[0])].slice(0,4);
                    if (!qObj.options.includes(answer)) {
                        let m = qObj.options.find(o => o.toLowerCase() === answer.toLowerCase());
                        if (m) qObj.answer = m; else qObj._error = 'விடை options-ல் இல்லை';
                    }
                }
                questions.push(qObj);
            }
            renderImportPreview(questions, 'csv-preview', 'csv-upload-btn', 'csv');
        } catch(err) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ Parse பிழை: '+err.message; }
    };
    reader.readAsText(file, 'UTF-8');
}

// CSV row parser (handles quoted fields with commas)
function parseCSVRow(row) {
    let result = [], current = '', inQuotes = false;
    for (let i = 0; i < row.length; i++) {
        let ch = row[i];
        if (ch === '"') {
            if (inQuotes && row[i+1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current); current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result.map(f => f.trim().replace(/^"|"$/g,''));
}

// ── Excel Import ──────────────────────────────────────────────────
function handleExcelDrop(e) {
    e.preventDefault();
    document.getElementById('excel-drop-zone').classList.remove('dragover');
    let file = e.dataTransfer.files[0];
    if (file) parseExcelFile(file);
}
function handleExcelSelect(e) { if (e.target.files[0]) parseExcelFile(e.target.files[0]); }

function parseExcelFile(file) {
    let statusEl = document.getElementById('mcq-file-status');
    statusEl.style.color = '#6366f1'; statusEl.textContent = '⏳ Excel படிக்கப்படுகிறது...';

    if (typeof XLSX === 'undefined') {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = '❌ SheetJS library load ஆகவில்லை. Internet connection சரிபார்க்கவும்.';
        return;
    }

    let reader = new FileReader();
    reader.onload = e => {
        try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, { type: 'array' });
            let sheet = workbook.Sheets[workbook.SheetNames[0]];
            let jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

            if (jsonRows.length < 2) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ Data இல்லை!'; return; }

            // Detect header row
            let headerRow = jsonRows[0].map(h => String(h).toLowerCase().trim());
            let qIdx = headerRow.findIndex(h => h.includes('question') || h.includes('கேள்வி') || h === 'q');
            let aIdx = headerRow.findIndex(h => h.includes('answer') || h.includes('விடை') || h === 'ans');
            // If no header, assume fixed columns: #, Question, A, B, C, D, Answer
            if (qIdx < 0) { qIdx = 1; aIdx = 6; }

            let oIdx = [2, 3, 4, 5]; // A, B, C, D columns

            let cls = document.getElementById('bulk-class').value || '';
            let subject = document.getElementById('bulk-subject').value || '';
            let chapter = (document.getElementById('bulk-chapter') || {}).value || '';
            let diff    = (document.getElementById('bulk-difficulty') || {}).value || 'medium';

            let questions = [];
            let startRow = (headerRow.includes('question') || headerRow.includes('கேள்வி') || headerRow.includes('q')) ? 1 : 0;

            for (let i = startRow; i < jsonRows.length; i++) {
                let row = jsonRows[i];
                let question = String(row[qIdx] || '').trim();
                let answer   = String(row[aIdx] || '').trim();
                if (!question || !answer) continue;

                let opts = oIdx.map(oi => String(row[oi] || '').trim()).filter(Boolean);
                let subjectCell = String(row[headerRow.indexOf('subject') >= 0 ? headerRow.indexOf('subject') : 7] || subject).trim();
                let clsCell     = String(row[headerRow.indexOf('class') >= 0 ? headerRow.indexOf('class') : 8] || cls).trim();
                let chapCell    = String(row[headerRow.indexOf('chapter') >= 0 ? headerRow.indexOf('chapter') : 9] || chapter).trim();
                let diffCell    = String(row[headerRow.indexOf('difficulty') >= 0 ? headerRow.indexOf('difficulty') : 10] || diff).trim();

                let qObj = { question, answer, subject: subjectCell||subject, class: clsCell||cls, chapter: chapCell, difficulty: diffCell||diff, type: 'mcq' };

                if (opts.length >= 2) {
                    qObj.options = opts.slice(0, 4);
                    while (qObj.options.length < 4) qObj.options.push(qObj.options[0]);
                    if (!qObj.options.includes(answer)) {
                        let m = qObj.options.find(o => o.toLowerCase() === answer.toLowerCase());
                        if (m) qObj.answer = m; else qObj._error = 'விடை options-ல் இல்லை';
                    }
                }
                questions.push(qObj);
            }
            renderImportPreview(questions, 'excel-preview', 'excel-upload-btn', 'excel');
        } catch(err) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ Excel parse பிழை: '+err.message; }
    };
    reader.readAsArrayBuffer(file);
}

// ── Upload Parsed Questions (CSV/Excel) ───────────────────────────
async function uploadParsedQuestions(source) {
    let questions = (_parsedImportQuestions[source] || []).filter(q => !q._error);
    if (!questions.length) { alert('Valid கேள்விகள் இல்லை!'); return; }

    let cls     = document.getElementById('bulk-class').value;
    let subject = document.getElementById('bulk-subject').value;
    if (!cls || !subject) { alert('வகுப்பு & பாடம் தேர்வு செய்யவும்!'); return; }

    let statusEl   = document.getElementById('file-import-upload-status');
    let uploadBtn  = document.getElementById(source + '-upload-btn');
    statusEl.style.color = '#6366f1'; statusEl.textContent = `⏳ ${questions.length} கேள்விகள் upload ஆகிறது...`;
    if (uploadBtn) uploadBtn.disabled = true;

    try {
        const BATCH_SIZE = 400;
        let uploaded = 0, dupCount = 0;

        for (let b = 0; b < questions.length; b += BATCH_SIZE) {
            let batch = db.batch();
            let slice = questions.slice(b, b + BATCH_SIZE);
            for (let q of slice) {
                // Apply current class/subject if empty
                if (!q.class) q.class = cls;
                if (!q.subject) q.subject = subject;
                let isDup = await checkDuplicate(q.question, q.subject, q.class).catch(() => false);
                if (isDup) { dupCount++; continue; }
                let docRef = db.collection('quiz_questions').doc();
                let data = { subject: q.subject, class: q.class, type: 'mcq', question: q.question, answer: q.answer, chapter: q.chapter||'', difficulty: q.difficulty||'medium' };
                if (q.options && q.options.length) data.options = q.options;
                batch.set(docRef, data);
                uploaded++;
            }
            await batch.commit();
        }

        statusEl.style.color = '#10b981';
        statusEl.textContent = `✅ ${uploaded} கேள்விகள் upload ஆனது!${dupCount?' ('+dupCount+' dup skip)':''}`;
        logActivity('upload', `${source.toUpperCase()} import: ${uploaded} MCQ (${subject}, ${cls} வகுப்பு)`);
        _parsedImportQuestions[source] = [];
        setTimeout(() => { statusEl.textContent = ''; if (uploadBtn) uploadBtn.disabled = false; }, 4000);
    } catch(e) {
        statusEl.style.color = '#ef4444'; statusEl.textContent = '❌ பிழை: ' + e.message;
        if (uploadBtn) uploadBtn.disabled = false;
    }
}

// ── PDF Text Extract → AI Tool ────────────────────────────────────
function handleMcqPdfDrop(e) {
    e.preventDefault();
    document.getElementById('mcq-pdf-drop-zone').classList.remove('dragover');
    let file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') extractPdfText(file);
    else alert('PDF file மட்டும்!');
}
function handleMcqPdfSelect(e) { if (e.target.files[0]) extractPdfText(e.target.files[0]); }

async function extractPdfText(file) {
    let statusEl  = document.getElementById('mcq-file-status');
    let preview   = document.getElementById('pdf-extract-preview');
    let btn       = document.getElementById('pdf-to-ai-btn');
    statusEl.style.color = '#6366f1'; statusEl.textContent = '⏳ PDF text extract ஆகிறது...';

    try {
        // Set PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Read as ArrayBuffer
        let arrayBuffer = await new Promise((res, rej) => {
            let reader = new FileReader();
            reader.onload = e => res(e.target.result);
            reader.onerror = rej;
            reader.readAsArrayBuffer(file);
        });

        // Also store base64 for AI tool
        let base64 = await new Promise((res, rej) => {
            let reader = new FileReader();
            reader.onload = e => res(e.target.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });
        window._mcqPdfBase64 = base64;
        window._mcqPdfName   = file.name;

        let extractedText = '';

        // Try PDF.js text extraction
        if (typeof pdfjsLib !== 'undefined') {
            let pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let pageCount = Math.min(pdf.numPages, 15); // max 15 pages
            for (let p = 1; p <= pageCount; p++) {
                let page = await pdf.getPage(p);
                let content = await page.getTextContent();
                let pageText = content.items.map(i => i.str).join(' ');
                extractedText += pageText + '\n';
            }
        }

        if (!extractedText.trim()) {
            // Fallback: just store base64 for AI
            extractedText = `[PDF: ${file.name} — ${(file.size/1024).toFixed(0)} KB]\nText extract ஆகவில்லை. AI Tool PDF mode-ல் direct upload செய்யவும்.`;
        }

        window._mcqPdfText = extractedText.substring(0, 4000);

        if (preview) {
            preview.textContent = extractedText.substring(0, 800) + (extractedText.length > 800 ? '...' : '');
            preview.classList.remove('hidden');
        }
        if (btn) btn.classList.remove('hidden');
        let ar = document.getElementById('pdf-action-row'); if (ar) ar.classList.remove('hidden');
        statusEl.style.color = '#10b981';
        statusEl.textContent = `✅ ${file.name} — ${extractedText.substring(0,50)}...`;

        // Update drop zone
        let dz = document.getElementById('mcq-pdf-drop-zone');
        if (dz) dz.innerHTML = `<div style="font-size:1.8rem;">✅</div><p style="font-weight:800;color:#166534;font-size:13px;">${file.name}</p><p style="font-size:11px;color:#64748b;">${(file.size/1024).toFixed(0)} KB extracted</p>`;

    } catch(e) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = '❌ Extract பிழை: ' + e.message;
        if (statusEl.textContent.includes('❌')) {
            if (window._mcqPdfBase64) {
                let ar = document.getElementById('pdf-action-row'); if (ar) ar.classList.remove('hidden');
                let b2 = document.getElementById('pdf-to-ai-btn'); if (b2) b2.classList.remove('hidden');
            }
        }
    }
}

function sendPdfToAiTool() {
    // Switch to AI tab and load PDF data
    switchAdminTab('ai');
    // Set PDF data in AI tool
    if (window._mcqPdfBase64) {
        _pdfBase64Data = window._mcqPdfBase64;
        let dz = document.getElementById('pdf-drop-zone');
        if (dz) dz.innerHTML = `<div style="font-size:1.8rem;">✅</div><p style="font-weight:800;color:#166534;font-size:13px;">${window._mcqPdfName||'PDF'}</p><p style="font-size:11px;color:#64748b;">MCQ Import-இல் இருந்து load ஆனது</p>`;
    }
    // Set text in text panel if extracted
    if (window._mcqPdfText) {
        let ta = document.getElementById('ai-text-input');
        if (ta) ta.value = window._mcqPdfText;
        switchAiTab('pdf');
    }
    // Show notification
    let statusEl = document.getElementById('ai-status-inline');
    if (statusEl) { statusEl.style.color='#10b981'; statusEl.textContent='✅ PDF AI Tool-ல் load ஆனது! Generate button click செய்யுங்கள்.'; }
}

// =================================================================
//  Settings Page v1.0 — Appearance, Language, Password, System
// =================================================================

const THEMES = {
    default:    'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #43e97b 100%)',
    ocean:      'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)',
    sunset:     'linear-gradient(135deg, #FA8231 0%, #F9CA24 50%, #EE5A24 100%)',
    forest:     'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    rose:       'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)',
    midnight:   'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    candy:      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    tamilnadu:  'linear-gradient(135deg, #FF6B35 0%, #F7C59F 50%, #004E89 100%)'
};

// ── Settings Tab Switch ───────────────────────────────────────────
function switchSettingsTab(tab) {
    ['appearance','language','password','teachers','system'].forEach(t => {
        let panel = document.getElementById('sset-' + t);
        let btn   = document.getElementById('stab-' + t);
        if (panel) panel.classList.toggle('hidden', t !== tab);
        if (btn) {
            let active = t === tab;
            btn.style.background = active ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#94a3b8';
            btn.style.boxShadow  = active ? '0 2px 0 #3730a3' : '0 2px 0 #64748b';
        }
    });
    if (tab === 'teachers') loadTeacherList();
    if (tab === 'appearance') loadAppearanceSettings();
    if (tab === 'language') loadLanguageSettings();
    if (tab === 'password') loadPasswordSettings();
    if (tab === 'system') loadSystemSettings();
}

// ── Theme ─────────────────────────────────────────────────────────
function applyTheme(name) {
    let grad = THEMES[name] || THEMES.default;
    document.body.style.background = grad;
    document.body.style.backgroundSize = '400% 400%';
    document.body.style.animation = 'gradientBG 18s ease infinite';
    localStorage.setItem('ua_theme', name);
    // Update active state
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    let el = document.getElementById('theme-' + name);
    if (el) el.classList.add('active');
    showSettingsStatus('✅ Theme மாற்றப்பட்டது!', '#10b981');
}

function loadAppearanceSettings() {
    let theme = localStorage.getItem('ua_theme') || 'default';
    document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
    let el = document.getElementById('theme-' + theme);
    if (el) el.classList.add('active');
    // Dark mode toggle state
    let dm = document.getElementById('dark-mode-toggle');
    if (dm) dm.checked = document.body.classList.contains('dark-mode');
    updateToggleVisual('dark-mode', dm ? dm.checked : false);
    // Animations
    let anim = document.getElementById('anim-toggle');
    if (anim) anim.checked = !document.body.classList.contains('no-anim');
    updateToggleVisual('anim', anim ? anim.checked : true);
    // Font size
    let fs = localStorage.getItem('ua_fontsize') || 'normal';
    updateFontSizeBtns(fs);
    // Container width
    let cw = localStorage.getItem('ua_container_width') || '560';
    updateContainerWidthBtns(cw);
}

function updateToggleVisual(id, on) {
    let sl = document.getElementById(id + (id==='dark-mode'?'-slider':'-slider') || id+'-sl');
    let kn = document.getElementById(id + (id==='dark-mode'?'-knob':'-knob') || id+'-kn');
    if (!sl) { sl = document.getElementById(id+'-sl'); kn = document.getElementById(id+'-kn'); }
    if (sl) sl.style.background = on ? '#6366f1' : '#cbd5e1';
    if (kn) kn.style.left = on ? '27px' : '3px';
}

// Override toggleDarkMode to also update slider
const _origToggleDM = window.toggleDarkMode;
window.toggleDarkMode = function() {
    if (_origToggleDM) _origToggleDM();
    let on = document.body.classList.contains('dark-mode');
    let dm = document.getElementById('dark-mode-toggle');
    if (dm) dm.checked = on;
    let sl = document.getElementById('dark-mode-slider');
    let kn = document.getElementById('dark-mode-knob');
    if (sl) sl.style.background = on ? '#6366f1' : '#cbd5e1';
    if (kn) kn.style.left = on ? '27px' : '3px';
    document.getElementById('dark-toggle').textContent = on ? '☀️' : '🌙';
};

function toggleAnimations() {
    let on = document.getElementById('anim-toggle').checked;
    document.body.classList.toggle('no-anim', !on);
    localStorage.setItem('ua_anim', on ? '1' : '0');
    let sl = document.getElementById('anim-slider');
    let kn = document.getElementById('anim-knob');
    if (sl) sl.style.background = on ? '#6366f1' : '#cbd5e1';
    if (kn) kn.style.left = on ? '27px' : '3px';
    if (!on) {
        let style = document.getElementById('no-anim-style') || document.createElement('style');
        style.id = 'no-anim-style';
        style.textContent = '*, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }';
        document.head.appendChild(style);
    } else {
        let s = document.getElementById('no-anim-style'); if (s) s.remove();
    }
}

function setFontSize(size) {
    document.body.classList.remove('font-lg', 'font-xl');
    if (size === 'lg') document.body.classList.add('font-lg');
    if (size === 'xl') document.body.classList.add('font-xl');
    localStorage.setItem('ua_fontsize', size);
    updateFontSizeBtns(size);
    showSettingsStatus('✅ Font size மாற்றப்பட்டது!', '#10b981');
}
function updateFontSizeBtns(size) {
    ['normal','lg','xl'].forEach(s => {
        let b = document.getElementById('fs-' + s);
        if (b) { b.style.background = s===size?'linear-gradient(135deg,#6366f1,#4f46e5)':'#94a3b8'; b.style.boxShadow = s===size?'0 2px 0 #3730a3':'0 2px 0 #64748b'; }
    });
}
function applyFontSize() {
    let size = localStorage.getItem('ua_fontsize') || 'normal';
    document.body.classList.remove('font-lg','font-xl');
    if (size==='lg') document.body.classList.add('font-lg');
    if (size==='xl') document.body.classList.add('font-xl');
}

function setContainerWidth(w) {
    document.querySelectorAll('.container').forEach(c => c.style.maxWidth = w+'px');
    localStorage.setItem('ua_container_width', w);
    updateContainerWidthBtns(w);
    showSettingsStatus('✅ அகலம் மாற்றப்பட்டது!', '#10b981');
}
function updateContainerWidthBtns(w) {
    [560,720,900].forEach(n => {
        let b = document.getElementById('cw-' + (n===560?'sm':n===720?'md':'lg'));
        if (b) { b.style.background = n===parseInt(w)?'linear-gradient(135deg,#6366f1,#4f46e5)':'#94a3b8'; b.style.boxShadow = n===parseInt(w)?'0 2px 0 #3730a3':'0 2px 0 #64748b'; }
    });
}
function applyContainerWidth() {
    let w = localStorage.getItem('ua_container_width');
    if (w) document.querySelectorAll('.container').forEach(c => c.style.maxWidth = w+'px');
}

// ── Language ──────────────────────────────────────────────────────
function setAppLanguage(lang) {
    localStorage.setItem('ua_lang', lang);
    document.querySelectorAll('.lang-card').forEach(c => c.classList.remove('active'));
    let el = document.getElementById('lang-' + lang);
    if (el) el.classList.add('active');
    ['ta','en','bi'].forEach(l => { let c = document.getElementById('lang-'+l+'-check'); if(c) c.style.opacity = l===lang ? '1':'0.2'; });
    showSettingsStatus('✅ மொழி மாற்றம் சேமிக்கப்பட்டது! (Reload-ல் பிரதிபலிக்கும்)', '#10b981');
}
function loadLanguageSettings() {
    let lang = localStorage.getItem('ua_lang') || 'ta';
    ['ta','en','bi'].forEach(l => {
        let c = document.getElementById('lang-'+l+'-check'); if(c) c.style.opacity = l===lang?'1':'0.2';
        let lc = document.getElementById('lang-'+l); if(lc) lc.classList.toggle('active', l===lang);
    });
    // Timer
    let timer = localStorage.getItem('ua_quiz_timer') || '30';
    let tv = document.getElementById('quiz-timer-val'); if(tv) tv.value = timer;
    // Default Q count
    let dqc = localStorage.getItem('ua_default_qcount') || '10';
    updateDQCBtns(dqc);
}
function saveQuizTimer() {
    let val = parseInt((document.getElementById('quiz-timer-val')||{}).value) || 30;
    val = Math.max(10, Math.min(120, val));
    localStorage.setItem('ua_quiz_timer', val);
    let s = document.getElementById('timer-save-status');
    if(s) { s.style.color='#10b981'; s.textContent='✅ Timer '+val+' விநாடிகள் சேமிக்கப்பட்டது!'; setTimeout(()=>s.textContent='',2500); }
}
function setDefaultQCount(n) {
    localStorage.setItem('ua_default_qcount', n);
    updateDQCBtns(n);
    // Update the student subject screen qcount buttons too
    window.selectedQCount = n;
    setQCount(n);
}
function updateDQCBtns(n) {
    [10,20,25,50].forEach(v => {
        let b = document.getElementById('dqc-'+v);
        if(b) { b.style.background = v===parseInt(n)?'linear-gradient(135deg,#6366f1,#4f46e5)':'#94a3b8'; b.style.boxShadow = v===parseInt(n)?'0 2px 0 #3730a3':'0 2px 0 #64748b'; }
    });
}

// ── Password ──────────────────────────────────────────────────────
function loadPasswordSettings() {
    // Populate user dropdown
    let sel = document.getElementById('pwd-change-user');
    if (!sel) return;
    sel.innerHTML = '<option value="">யாருடைய password மாற்ற?</option>';
    // Built-in teachers
    Object.entries(TEACHERS_DATA).forEach(([u,t]) => { sel.innerHTML += `<option value="${u}">${t.name} (@${u})</option>`; });
    // Firestore teachers
    db.collection('teachers').get().then(snap => {
        snap.forEach(doc => { let d=doc.data(); sel.innerHTML += `<option value="fs:${doc.id}">${d.name} (@${d.username})</option>`; });
    }).catch(()=>{});
    // Password strength meter
    let ni = document.getElementById('pwd-new');
    if (ni) ni.oninput = function() { updatePwdStrength(this.value); };
    // PIN
    let pin = localStorage.getItem('ua_pin');
    let ps = document.getElementById('pin-status');
    if (ps && pin) { ps.style.color='#10b981'; ps.textContent='🔒 PIN set ஆகியுள்ளது'; }
}
function updatePwdStrength(pwd) {
    let strength = 0;
    if (pwd.length >= 4) strength++;
    if (pwd.length >= 8) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    let colors = ['#ef4444','#f59e0b','#10b981','#6366f1'];
    let labels = ['மிக பலவீனம்','பலவீனம்','நல்லது','மிக வலிமை'];
    let fill = document.getElementById('pwd-strength-fill');
    let label = document.getElementById('pwd-strength-label');
    if (fill) { fill.style.width = (strength*25)+'%'; fill.style.background = colors[strength-1]||'#e2e8f0'; }
    if (label) { label.style.color = colors[strength-1]||'#94a3b8'; label.textContent = pwd ? (labels[strength-1]||'') : ''; }
}
async function changePassword() {
    let userSel = (document.getElementById('pwd-change-user')||{}).value;
    let current = (document.getElementById('pwd-current')||{}).value;
    let newPwd  = (document.getElementById('pwd-new')||{}).value;
    let confirm = (document.getElementById('pwd-confirm')||{}).value;
    let statusEl = document.getElementById('pwd-change-status');
    if (!userSel) { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ User தேர்வு செய்யவும்!'; return; }
    if (!current || !newPwd) { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ அனைத்து fields தேவை!'; return; }
    if (newPwd !== confirm) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ புதிய password match ஆகவில்லை!'; return; }
    if (newPwd.length < 4) { statusEl.style.color='#ef4444'; statusEl.textContent='⚠️ Password குறைந்தது 4 chars தேவை!'; return; }
    statusEl.style.color='#6366f1'; statusEl.textContent='⏳ மாற்றப்படுகிறது...';
    try {
        if (userSel.startsWith('fs:')) {
            let docId = userSel.slice(3);
            let doc = await db.collection('teachers').doc(docId).get();
            if (!doc.exists || doc.data().password !== current) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ தற்போதைய password தவறு!'; return; }
            await db.collection('teachers').doc(docId).update({ password: newPwd });
        } else {
            if (!TEACHERS_DATA[userSel] || TEACHERS_DATA[userSel].password !== current) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ தற்போதைய password தவறு! (Built-in users app code-ல் மாற்றவும்)'; return; }
        }
        statusEl.style.color='#10b981'; statusEl.textContent='✅ Password மாற்றப்பட்டது!';
        logActivity('settings', `${userSel} password மாற்றப்பட்டது`);
        ['pwd-current','pwd-new','pwd-confirm'].forEach(id => { let e=document.getElementById(id); if(e) e.value=''; });
        updatePwdStrength('');
    } catch(e) { statusEl.style.color='#ef4444'; statusEl.textContent='❌ பிழை: '+e.message; }
}
function savePIN() {
    let val = String((document.getElementById('pin-input')||{}).value||'').trim();
    if (val.length !== 4 || !/^\d{4}$/.test(val)) {
        let s=document.getElementById('pin-status'); if(s){s.style.color='#ef4444'; s.textContent='⚠️ 4-digit number தேவை!';}
        return;
    }
    localStorage.setItem('ua_pin', val);
    let s=document.getElementById('pin-status'); if(s){s.style.color='#10b981'; s.textContent='✅ PIN set ஆனது! 🔒';}
    let el=document.getElementById('pin-input'); if(el) el.value='';
}
function clearPIN() {
    localStorage.removeItem('ua_pin');
    let s=document.getElementById('pin-status'); if(s){s.style.color='#64748b'; s.textContent='PIN நீக்கப்பட்டது.';}
}

// ── System ────────────────────────────────────────────────────────
function loadSystemSettings() {
    // Load notification settings
    ['xp','sound'].forEach(k => {
        let on = localStorage.getItem('ua_notif_'+k) !== '0';
        let cb = document.getElementById('notif-'+k); if(cb) cb.checked = on;
        let sl = document.getElementById('notif-'+k+'-sl'); if(sl) sl.style.background = on?'#6366f1':'#cbd5e1';
        let kn = document.getElementById('notif-'+k+'-kn'); if(kn) kn.style.left = on?'22px':'2px';
    });
}
function saveNotifSetting(key, val) {
    localStorage.setItem('ua_notif_'+key, val?'1':'0');
    let sl = document.getElementById('notif-'+key+'-sl');
    let kn = document.getElementById('notif-'+key+'-kn');
    if(sl) sl.style.background = val?'#6366f1':'#cbd5e1';
    if(kn) kn.style.left = val?'22px':'2px';
    if (key==='sound') soundEnabled = val;
}
function exportAllSettings() {
    let settings = {};
    ['ua_theme','ua_fontsize','ua_container_width','ua_lang','ua_quiz_timer','ua_default_qcount','ua_dark','ua_font','ua_anim','ua_pin','ua_api_key'].forEach(k => {
        let v = localStorage.getItem(k); if(v !== null) settings[k] = v;
    });
    let json = JSON.stringify(settings, null, 2);
    downloadFile(json, 'ungal_aasiriyar_settings_backup.json', 'application/json');
    let s = document.getElementById('system-status'); if(s){s.style.color='#10b981'; s.textContent='✅ Settings exported!';}
}
function importAllSettings(e) {
    let file = e.target.files[0]; if(!file) return;
    let reader = new FileReader();
    reader.onload = ev => {
        try {
            let settings = JSON.parse(ev.target.result);
            Object.entries(settings).forEach(([k,v]) => localStorage.setItem(k,v));
            let s = document.getElementById('system-status'); if(s){s.style.color='#10b981'; s.textContent='✅ Settings imported! Reload-ல் பிரதிபலிக்கும்.';}
            applyTheme(settings.ua_theme||'default');
            applyFontSize();
            applyContainerWidth();
        } catch(err) {
            let s = document.getElementById('system-status'); if(s){s.style.color='#ef4444'; s.textContent='❌ Invalid JSON file!';}
        }
    };
    reader.readAsText(file);
}
function clearLocalStorage() {
    if (!confirm('App cache அழிக்கவா? (Login info & settings நீங்கும் — Questions Firestore-ல் safe)')) return;
    let keysToKeep = ['ua_api_key'];
    let saved = {};
    keysToKeep.forEach(k => { let v=localStorage.getItem(k); if(v) saved[k]=v; });
    localStorage.clear();
    keysToKeep.forEach(k => { if(saved[k]) localStorage.setItem(k,saved[k]); });
    let s = document.getElementById('system-status'); if(s){s.style.color='#10b981'; s.textContent='✅ Cache அழிக்கப்பட்டது! Reloading...';}
    setTimeout(() => location.reload(), 1500);
}

function showSettingsStatus(msg, color) {
    let s = document.getElementById('settings-global-status');
    if (!s) return;
    s.style.color = color;
    s.textContent = msg;
    setTimeout(() => s.textContent = '', 2500);
}

// ── Patch loadTeacherList for settings tab ────────────────────────
function switchAdminTabOld_override() {}

// ── Init on load — apply saved settings ──────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Apply theme
    let theme = localStorage.getItem('ua_theme');
    if (theme && THEMES[theme]) applyTheme(theme);
    // Apply container width
    applyContainerWidth();
    // Apply animations
    let anim = localStorage.getItem('ua_anim');
    if (anim === '0') toggleAnimations();
    // Update settings tab to default to appearance
    let stab = document.getElementById('stab-appearance');
    if (stab) switchSettingsTab('appearance');
});

// ── Patch loadTeacherList to work within settings tab ─────────────
// (already defined; settings tab calls it via switchSettingsTab → loadTeacherList)

// ── Smart Print Certificate ───────────────────────────────────────

// ── Print Certificate — Popup Preview with manual print ───────────
function printCertificate() {
    var name    = (document.getElementById('cert-name')         || {}).innerText || '';
    var cls     = (document.getElementById('cert-class-display')|| {}).innerText || '';
    var subject = (document.getElementById('cert-subject')      || {}).innerText || '';
    var score   = (document.getElementById('cert-score')        || {}).innerText || '';
    var date    = (document.getElementById('cert-date')         || {}).innerText || '';

    var pw = window.open('', '_blank', 'width=960,height=720,menubar=yes,toolbar=yes');
    if (!pw) { alert('Popup blocked! Browser settings-ல் popup allow செய்யவும், பிறகு மீண்டும் click செய்யவும்.'); return; }

    pw.document.open();
    pw.document.write('<!DOCTYPE html><html lang="ta"><head><meta charset="UTF-8">');
    pw.document.write('<title>சான்றிதழ் - ' + name + '</title>');
    pw.document.write('<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet">');
    pw.document.write('<style>');
    pw.document.write('@page{size:A4 landscape;margin:8mm}');
    pw.document.write('*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}');
    pw.document.write('body{margin:0;padding:80px 20px 20px;font-family:\'Nunito\',sans-serif;background:#f1f5f9;min-height:100vh}');
    pw.document.write('.toolbar{position:fixed;top:0;left:0;right:0;background:#1e293b;padding:12px 20px;display:flex;gap:10px;z-index:999;align-items:center}');
    pw.document.write('.toolbar span{color:#94a3b8;font-size:13px;font-weight:700;flex:1}');
    pw.document.write('.btn{border:none;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:800;cursor:pointer;font-family:\'Nunito\',sans-serif}');
    pw.document.write('.btn-print{background:linear-gradient(135deg,#6366f1,#4f46e5);color:white}');
    pw.document.write('.btn-save{background:linear-gradient(135deg,#10b981,#059669);color:white}');
    pw.document.write('.btn-close{background:#334155;color:#94a3b8}');
    pw.document.write('.outer{width:100%;max-width:260mm;margin:0 auto;border:8px solid #1e3a8a;border-radius:12px;padding:5px;background:white;box-shadow:0 8px 32px rgba(0,0,0,0.15)}');
    pw.document.write('.inner{border:3px solid #3b82f6;border-radius:8px;background:linear-gradient(135deg,#ffffff 0%,#f0fdf4 100%);padding:16px 24px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px}');
    pw.document.write('.logo{width:75px;height:75px;border-radius:18px;object-fit:cover}');
    pw.document.write('.title{font-size:26pt;color:#166534;font-weight:900;margin:0}');
    pw.document.write('.subtitle{font-size:10pt;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin:0}');
    pw.document.write('.cert-text{font-size:11pt;color:#334155;font-weight:700;margin:2px 0;line-height:1.5}');
    pw.document.write('.sname{font-size:22pt;color:#b91c1c;font-weight:900;border-bottom:2px dashed #cbd5e1;padding-bottom:3px;margin:4px 0}');
    pw.document.write('.scls{font-size:10pt;color:#475569;font-weight:700;margin:0}');
    pw.document.write('.ssubject{font-size:14pt;color:#1d4ed8;font-weight:900}');
    pw.document.write('.sbox{background:#fef3c7;border:2px dashed #f59e0b;border-radius:12px;padding:8px 24px;margin:4px 0}');
    pw.document.write('.sbox h3{color:#b45309;font-size:14pt;font-weight:900;margin:0}');
    pw.document.write('.footer{display:flex;justify-content:space-between;align-items:flex-end;width:100%;margin-top:10px;padding:0 10px}');
    pw.document.write('.fcol{text-align:center;flex:1}');
    pw.document.write('.fcol p{font-size:9pt;font-weight:800;margin:0}');
    pw.document.write('.fline{border-top:2px solid #cbd5e1;padding-top:4px;color:#64748b}');
    pw.document.write('.seal{width:40px;height:40px;background:#fbbf24;border-radius:50%;border:3px double #b45309;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto 4px}');
    pw.document.write('@media print{.toolbar{display:none!important}body{background:white;padding:0}}');
    pw.document.write('</style></head><body>');
    pw.document.write('<div class="toolbar">');
    pw.document.write('<span>📜 சான்றிதழ் Preview — ' + name + '</span>');
    pw.document.write('<button class="btn btn-print" onclick="window.print()">🖨️ Print</button>');
    pw.document.write('<button class="btn btn-save" onclick="window.print()">💾 PDF Save</button>');
    pw.document.write('<button class="btn btn-close" onclick="window.close()">✕ Close</button>');
    pw.document.write('</div>');
    pw.document.write('<div class="outer"><div class="inner">');
    pw.document.write('<img src="20260315_085358.png" class="logo" onerror="this.outerHTML=\'<div style=&quot;font-size:3rem&quot;>🎓</div>\'">');
    pw.document.write('<h1 class="title">பாராட்டுச் சான்றிதழ்</h1>');
    pw.document.write('<p class="subtitle">Certificate of Excellence</p>');
    pw.document.write('<p class="cert-text">இந்தச் சான்றிதழ்</p>');
    pw.document.write('<div class="sname">' + name + '</div>');
    pw.document.write('<p class="scls">' + cls + '</p>');
    pw.document.write('<p class="cert-text">அவர்களுக்கு, <span class="ssubject">' + subject + '</span><br>பாடத்தில் நடைபெற்ற வினாடி-வினா தேர்வில் சிறப்பாகப் பங்கேற்று</p>');
    pw.document.write('<div class="sbox"><h3>மதிப்பெண்கள்: <span style="font-size:1.2em">' + score + '</span></h3></div>');
    pw.document.write('<p class="cert-text">பெற்றமைக்காக அன்புடன் வழங்கப்படுகிறது.</p>');
    pw.document.write('<div class="footer">');
    pw.document.write('<div class="fcol"><p>' + date + '</p><p class="fline">தேதி (Date)</p></div>');
    pw.document.write('<div class="fcol"><div class="seal">🏆</div></div>');
    pw.document.write('<div class="fcol"><p style="font-family:cursive;color:#1e293b">உங்கள் ஆசிரியர்</p><p class="fline">கையொப்பம்</p></div>');
    pw.document.write('</div></div></div>');
    pw.document.write('</body></html>');
    pw.document.close();
}
