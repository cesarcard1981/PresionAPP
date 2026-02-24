// ============================================================
// FIREBASE
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, setDoc, getDoc }
    from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signInAnonymously, onAuthStateChanged, signOut, updateProfile }
    from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA5j0iW38OHGtq8t-GXJQWlImj1ZifyttI",
    authDomain: "presionapp-ed086.firebaseapp.com",
    projectId: "presionapp-ed086",
    storageBucket: "presionapp-ed086.firebasestorage.app",
    messagingSenderId: "1090808855881",
    appId: "1:1090808855881:web:7d0ad6fdd4e79606426e98"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
const provider = new GoogleAuthProvider();

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let pressureData = [];
let authMode = 'login';
let editingId = null;
let unsubSnap = null;
let userProfile = { age: null, medication: 'no', targetSys: 120, targetDia: 80 };
let chartDays = 7;

let currentLang = localStorage.getItem('lang') || 'es';
let currentTheme = localStorage.getItem('theme') || 'light';
const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix";

// ============================================================
// CLASIFICACIÓN DE PRESIÓN (mejora #1)
// ============================================================
const BP_CATEGORIES = [
    { key: 'optimal',    label: 'Óptima',          labelEn: 'Optimal',        color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: 'check-circle',  minSys: 0,   maxSys: 120, minDia: 0,  maxDia: 80  },
    { key: 'normal',     label: 'Normal',           labelEn: 'Normal',         color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  icon: 'check-circle',  minSys: 120, maxSys: 130, minDia: 80, maxDia: 85  },
    { key: 'high_normal',label: 'Normal-Alta',      labelEn: 'High Normal',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: 'alert-circle',  minSys: 130, maxSys: 140, minDia: 85, maxDia: 90  },
    { key: 'hyp1',       label: 'Hipertensión I',   labelEn: 'Hypertension I', color: '#f97316', bg: 'rgba(249,115,22,0.12)', icon: 'alert-triangle',minSys: 140, maxSys: 160, minDia: 90, maxDia: 100 },
    { key: 'hyp2',       label: 'Hipertensión II',  labelEn: 'Hypertension II',color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: 'alert-triangle',minSys: 160, maxSys: 180, minDia: 100,maxDia: 110 },
    { key: 'hyp3',       label: 'Hipertensión III', labelEn: 'Hypertension III',color:'#991b1b', bg: 'rgba(153,27,27,0.12)',  icon: 'x-circle',      minSys: 180, maxSys: 999, minDia: 110,maxDia: 999 },
    { key: 'low',        label: 'Hipotensión',      labelEn: 'Low Blood Pressure',color:'#6366f1',bg:'rgba(99,102,241,0.12)',icon: 'arrow-down-circle', minSys:0, maxSys:90, minDia:0, maxDia:60 }
];

function classifyBP(sys, dia) {
    if (sys < 90 || dia < 60) return BP_CATEGORIES.find(c => c.key === 'low');
    if (sys >= 180 || dia >= 110) return BP_CATEGORIES.find(c => c.key === 'hyp3');
    if (sys >= 160 || dia >= 100) return BP_CATEGORIES.find(c => c.key === 'hyp2');
    if (sys >= 140 || dia >= 90)  return BP_CATEGORIES.find(c => c.key === 'hyp1');
    if (sys >= 130 || dia >= 85)  return BP_CATEGORIES.find(c => c.key === 'high_normal');
    if (sys >= 120 || dia >= 80)  return BP_CATEGORIES.find(c => c.key === 'normal');
    return BP_CATEGORIES.find(c => c.key === 'optimal');
}

const BP_DESCRIPTIONS = {
    optimal:    { es: 'Excelente. Tu presión está en el rango ideal.', en: 'Excellent. Your blood pressure is in the ideal range.' },
    normal:     { es: 'Bien. Dentro del rango normal.', en: 'Good. Within normal range.' },
    high_normal:{ es: 'Atención. Ligeramente elevada, controlá tu dieta.', en: 'Watch out. Slightly elevated, monitor your diet.' },
    hyp1:       { es: 'Consulté tu médico. Hipertensión leve detectada.', en: 'Consult your doctor. Mild hypertension detected.' },
    hyp2:       { es: 'Importante. Hipertensión moderada, buscá atención médica.', en: 'Important. Moderate hypertension, seek medical care.' },
    hyp3:       { es: '⚠️ Urgente. Hipertensión severa, consultá de inmediato.', en: '⚠️ Urgent. Severe hypertension, consult immediately.' },
    low:        { es: 'Presión baja detectada. Hidratate y consultá si persiste.', en: 'Low blood pressure detected. Stay hydrated and consult if it persists.' }
};

// ============================================================
// TRANSLATIONS
// ============================================================
const T = {
    es: {
        last_measurement:'Última Medición', weekly_avg:'Promedio Semanal',
        readings_count:'Basado en lecturas', heart_rate:'Ritmo Cardíaco',
        weekly_trend:'Tendencia Semanal', filter_7:'7 Días', filter_30:'30 Días',
        recent_history:'Mediciones Recientes', view_all:'Ver todo',
        date:'Fecha', time:'Hora', pressure:'Presión (S/D)', pulse:'Pulso',
        notes:'Notas', settings:'Ajustes', dark_mode:'Modo Oscuro',
        dark_mode_desc:'Cambia el fondo a negro para mayor comodidad visual',
        language:'Idioma', language_desc:'Selecciona tu idioma preferido',
        new_entry_title:'Añadir Nueva Medición', edit_entry_title:'Modificar Medición',
        systolic:'Sistólica', diastolic:'Diastólica', pulse_bpm:'Pulso (BPM)',
        optional:'(Opcional)', notes_field:'Notas (Opcional)', save_entry:'Guardar Registro',
        edit:'Modificar', delete:'Eliminar',
        empty_title:'¡Comienza tu primer registro!',
        empty_desc:'Parece que aún no tienes mediciones. Pulsa el botón de arriba para añadir la primera.',
        nav_dashboard:'Dashboard', nav_history:'Historial', nav_reports:'Reportes',
        nav_dashboard_short:'Dash', nav_chart:'Gráfico',
        logout:'Cerrar Sesión', status_active:'Activo',
        confirm_delete:'¿Borrar medición?', auth_welcome:'Tu control arterial profesional',
        btn_login:'Ingresar', btn_register:'Registrar y Entrar',
        no_account:'¿No tienes cuenta?', has_account:'¿Ya tienes cuenta?',
        create_user:'Crear Usuario', login_now:'Iniciar Sesión',
        profile_picture:'Foto de Perfil', profile_picture_desc:'Personaliza tu avatar o sube una foto',
        upload_photo:'Subir Foto', saving:'Guardando...', loading:'Cargando datos...', sync_ok:'✓ Sincronizado'
    },
    en: {
        last_measurement:'Last Measurement', weekly_avg:'Weekly Average',
        readings_count:'Based on readings', heart_rate:'Heart Rate',
        weekly_trend:'Weekly Trend', filter_7:'7 Days', filter_30:'30 Days',
        recent_history:'Recent Readings', view_all:'View all',
        date:'Date', time:'Time', pressure:'Pressure (S/D)', pulse:'Pulse',
        notes:'Notes', settings:'Settings', dark_mode:'Dark Mode',
        dark_mode_desc:'Change background to black for visual comfort',
        language:'Language', language_desc:'Select your preferred language',
        new_entry_title:'Add New Measurement', edit_entry_title:'Edit Measurement',
        systolic:'Systolic', diastolic:'Diastolic', pulse_bpm:'Pulse (BPM)',
        optional:'(Optional)', notes_field:'Notes (Optional)', save_entry:'Save Entry',
        edit:'Modify', delete:'Delete',
        empty_title:'Start your first record!',
        empty_desc:"It looks like you don't have any measurements yet. Press the button above to add the first one.",
        nav_dashboard:'Dashboard', nav_history:'History', nav_reports:'Reports',
        nav_dashboard_short:'Dash', nav_chart:'Chart',
        logout:'Logout', status_active:'Active',
        confirm_delete:'Delete measurement?', auth_welcome:'Your professional arterial control',
        btn_login:'Login', btn_register:'Register & Enter',
        no_account:"Don't have an account?", has_account:'Already have an account?',
        create_user:'Create User', login_now:'Login Now',
        profile_picture:'Profile Picture', profile_picture_desc:'Customize your avatar or upload a photo',
        upload_photo:'Upload Photo', saving:'Saving...', loading:'Loading data...', sync_ok:'✓ Synced'
    }
};

// ============================================================
// DOM REFS
// ============================================================
const authScreen   = document.getElementById('authScreen');
const appMain      = document.getElementById('appMain');
const authForm     = document.getElementById('authForm');
const histBody     = document.getElementById('historyTableBody');
const entryModal   = document.getElementById('entryModal');
const entryForm    = document.getElementById('entryForm');
const settingsModal= document.getElementById('settingsModal');
const reminderModal= document.getElementById('reminderModal');
const onboardModal = document.getElementById('onboardingModal');
const langSelect   = document.getElementById('languageSelect');
const themeToggle  = document.getElementById('themeToggle');
const emptyState   = document.getElementById('emptyState');
const dashGrid     = document.querySelector('.dashboard-grid');
const sidebar      = document.querySelector('.sidebar');
const sidebarToggle= document.getElementById('sidebarToggle');
const loadingOverlay=document.getElementById('loadingOverlay');
const syncIndicator= document.getElementById('syncIndicator');

document.documentElement.setAttribute('data-theme', currentTheme);

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    updateThemeUI();
    applyTranslations();
    bindEvents();
    if (window.lucide) lucide.createIcons();

    // Verificar si hay resultado de redirect pendiente (fallback mobile)
    getRedirectResult(auth)
        .then((result) => {
            if (result?.user) {
                console.log('Google redirect OK:', result.user.displayName);
            }
        })
        .catch((err) => {
            if (err.code && err.code !== 'auth/no-current-user') {
                console.warn('getRedirectResult error:', err.code);
            }
        });

    onAuthStateChanged(auth, (user) => {
        if (user) { currentUser = user; onUserLoggedIn(user); }
        else       { currentUser = null; onUserLoggedOut(); }
        if (loadingOverlay) {
            loadingOverlay.classList.add('fade-out');
            setTimeout(() => loadingOverlay.style.display = 'none', 500);
        }
    });
});

// ============================================================
// AUTH HANDLERS
// ============================================================
function onUserLoggedIn(user) {
    const nameEl = document.querySelector('.user-name');
    if (nameEl) nameEl.innerText = (user.displayName || user.email || 'Usuario').toUpperCase();
    const avatarImg = document.querySelector('.user-profile img');
    if (avatarImg) avatarImg.src = localStorage.getItem(`pa_avatar_${user.uid}`) || user.photoURL || DEFAULT_AVATAR;
    authScreen.classList.add('hidden');
    appMain.classList.remove('hidden');
    loadUserProfile(user.uid).then(() => {
        // Aplicar perfil pendiente guardado durante onboarding (antes de que Firebase confirmara sesion)
        const pending = localStorage.getItem('pa_profile_pending');
        if (pending) {
            try {
                const p = JSON.parse(pending);
                saveUserProfile(p).then(() => localStorage.removeItem('pa_profile_pending'));
            } catch(e) {}
        }
        startDataListener(user.uid);
        checkOnboarding(user.uid);
        initReminders();
    });
}

function onUserLoggedOut() {
    if (unsubSnap) { unsubSnap(); unsubSnap = null; }
    pressureData = [];
    authScreen.classList.remove('hidden');
    appMain.classList.add('hidden');
}

// ============================================================
// USER PROFILE (mejora #5)
// ============================================================
async function loadUserProfile(uid) {
    try {
        const snap = await getDoc(doc(db, 'users', uid, 'meta', 'profile'));
        if (snap.exists()) {
            userProfile = { ...userProfile, ...snap.data() };
            if (document.getElementById('settingsAge')) document.getElementById('settingsAge').value = userProfile.age || '';
            if (document.getElementById('settingsTargetSys')) document.getElementById('settingsTargetSys').value = userProfile.targetSys || 120;
        }
    } catch(e) { console.warn('Profile load:', e); }
}

async function saveUserProfile(data) {
    if (!currentUser) return;
    userProfile = { ...userProfile, ...data };
    await setDoc(doc(db, 'users', currentUser.uid, 'meta', 'profile'), userProfile, { merge: true });
}

function checkOnboarding(uid) {
    if (!userProfile.onboardingDone) {
        onboardModal.style.display = 'flex';
        if (window.lucide) lucide.createIcons();
    }
}

function bindOnboarding() {
    // Toggle medicacion - usar onclick para evitar listeners duplicados
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    const nextBtn = document.getElementById('onboardingNext');
    if (nextBtn) {
        nextBtn.onclick = () => {
            const age = parseInt(document.getElementById('ob_age')?.value) || null;
            const medication = document.querySelector('.toggle-btn.active')?.dataset.val || 'no';
            userProfile.age = age;
            userProfile.medication = medication;
            document.getElementById('step1').classList.add('hidden');
            document.getElementById('step2').classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        };
    }

    const finishBtn = document.getElementById('onboardingFinish');
    if (finishBtn) {
        finishBtn.onclick = async () => {
            finishBtn.disabled = true;
            finishBtn.textContent = 'Guardando...';
            try {
                const targetSys    = parseInt(document.getElementById('ob_targetSys')?.value) || 120;
                const targetDia    = parseInt(document.getElementById('ob_targetDia')?.value) || 80;
                const reminderTime = document.getElementById('ob_reminderTime')?.value || '';
                userProfile.targetSys      = targetSys;
                userProfile.targetDia      = targetDia;
                userProfile.onboardingDone = true;
                if (reminderTime) {
                    localStorage.setItem('pa_reminder1', reminderTime);
                    scheduleReminder(reminderTime);
                }
                if (currentUser) {
                    await saveUserProfile(userProfile);
                } else {
                    localStorage.setItem('pa_profile_pending', JSON.stringify(userProfile));
                }
                onboardModal.style.display = 'none';
                updateUI();
                showSync('Perfil configurado', true);
            } catch(err) {
                console.error('Onboarding save error:', err);
                localStorage.setItem('pa_profile_pending', JSON.stringify(userProfile));
                onboardModal.style.display = 'none';
                updateUI();
            } finally {
                finishBtn.disabled = false;
                finishBtn.textContent = 'Empezar a registrar';
            }
        };
    }

    const skipBtn = document.getElementById('onboardingSkip');
    if (skipBtn) {
        skipBtn.onclick = async () => {
            userProfile.onboardingDone = true;
            try {
                if (currentUser) await saveUserProfile({ onboardingDone: true });
                else localStorage.setItem('pa_profile_pending', JSON.stringify({ onboardingDone: true }));
            } catch(err) { console.warn('Skip save:', err); }
            onboardModal.style.display = 'none';
        };
    }
}

// ============================================================
// FIRESTORE LISTENER
// ============================================================
function startDataListener(uid) {
    if (unsubSnap) unsubSnap();
    showSync(T[currentLang].loading);
    const q = query(collection(db, 'users', uid, 'measurements'), orderBy('timestamp', 'asc'));
    unsubSnap = onSnapshot(q, (snap) => {
        pressureData = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
        updateUI();
        initChart();
        showSync(T[currentLang].sync_ok, true);
    }, err => { console.error(err); showSync('⚠ Error de conexión'); });
}

// ============================================================
// FIRESTORE CRUD
// ============================================================
async function addMeasurement(data) {
    await addDoc(collection(db, 'users', currentUser.uid, 'measurements'), { ...data, timestamp: Date.now() });
}
async function updateMeasurement(id, data) {
    await updateDoc(doc(db, 'users', currentUser.uid, 'measurements', id), data);
}
async function deleteMeasurement(id) {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'measurements', id));
}

// ============================================================
// SYNC INDICATOR
// ============================================================
function showSync(msg, autoHide = false) {
    if (!syncIndicator) return;
    syncIndicator.textContent = msg;
    syncIndicator.style.opacity = '1';
    if (autoHide) setTimeout(() => syncIndicator.style.opacity = '0', 2500);
}

// ============================================================
// LOGIN
// ============================================================
function loginWithUsername(username) {
    signInAnonymously(auth)
        .then(cred => updateProfile(cred.user, { displayName: username }))
        .catch(err => { console.error(err); alert('Error al iniciar sesión.'); });
}
function loginWithGoogle() {
    const btn = document.getElementById('googleLoginBtn');
    const txt = document.getElementById('googleBtnText');
    const sp  = document.getElementById('googleBtnSpinner');
    if (btn) btn.disabled = true;
    if (txt) txt.textContent = 'Conectando...';
    if (sp) sp.classList.remove('hidden');

    provider.setCustomParameters({
        client_id: '1090808855881-6ge4jb78pmoks3vn4tlttdgv77jqnt0l.apps.googleusercontent.com',
        prompt: 'select_account'
    });

    // Usar popup — evita el problema de Chrome con redirects intermedios
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log('Google popup OK:', result.user.displayName);
            // onAuthStateChanged se encarga del resto
        })
        .catch((err) => {
            console.error('Google popup error:', err.code, err.message);

            if (err.code === 'auth/popup-blocked') {
                // Si el popup fue bloqueado, intentar redirect como ultimo recurso
                alert('Tu navegador bloqueó el popup. Vas a ser redirigido a Google para iniciar sesión.');
                signInWithRedirect(auth, provider);
                return;
            }

            if (btn) btn.disabled = false;
            if (txt) txt.textContent = 'Continuar con Google';
            if (sp) sp.classList.add('hidden');

            if (err.code === 'auth/popup-closed-by-user') return; // El usuario lo cerró, no es error

            const friendlyErrors = {
                'auth/unauthorized-domain':   '❌ Dominio no autorizado en Firebase.\nAgregar cesarcard1981.github.io en:\nFirebase → Authentication → Settings → Authorized domains.',
                'auth/operation-not-allowed': '❌ Login con Google no habilitado.\nActivalo en Firebase → Authentication → Sign-in method → Google.',
                'auth/invalid-api-key':       '❌ API Key inválida en firebaseConfig.',
                'auth/cancelled-popup-request': null, // Ignorar silenciosamente
            };
            const msg = friendlyErrors[err.code];
            if (msg) alert(msg);
            else if (msg !== null) alert('Error al iniciar sesión (' + err.code + ')');
        });
}
function doLogout() { signOut(auth); }

// ============================================================
// REMINDERS (mejora #3)
// ============================================================
function initReminders() {
    const r1 = localStorage.getItem('pa_reminder1');
    const r2 = localStorage.getItem('pa_reminder2');
    if (document.getElementById('reminder1Input') && r1) document.getElementById('reminder1Input').value = r1;
    if (document.getElementById('reminder2Input') && r2) document.getElementById('reminder2Input').value = r2;
    if (r1) scheduleReminder(r1, 1);
    if (r2) scheduleReminder(r2, 2);
}

function scheduleReminder(timeStr, idx = 1) {
    if (!timeStr) return;
    const checkAndNotify = () => {
        const now = new Date();
        const [h, m] = timeStr.split(':').map(Number);
        if (now.getHours() === h && now.getMinutes() === m) {
            if (Notification.permission === 'granted') {
                new Notification('⏰ PresionApp — Hora de medir', {
                    body: 'Recordatorio: tomá tu medición de presión arterial.',
                    icon: '/favicon.ico'
                });
            }
        }
    };
    // Check every minute
    const key = `pa_reminder_interval_${idx}`;
    if (window[key]) clearInterval(window[key]);
    window[key] = setInterval(checkAndNotify, 60000);
}

async function saveReminders() {
    const r1 = document.getElementById('reminder1Input')?.value;
    const r2 = document.getElementById('reminder2Input')?.value;

    if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
            document.getElementById('reminderPermissionWarning')?.classList.remove('hidden');
            return;
        }
    }
    if (Notification.permission === 'denied') {
        document.getElementById('reminderPermissionWarning')?.classList.remove('hidden');
        return;
    }

    if (r1) { localStorage.setItem('pa_reminder1', r1); scheduleReminder(r1, 1); }
    else localStorage.removeItem('pa_reminder1');
    if (r2) { localStorage.setItem('pa_reminder2', r2); scheduleReminder(r2, 2); }
    else localStorage.removeItem('pa_reminder2');

    reminderModal.style.display = 'none';
    showSync('🔔 Recordatorios guardados', true);
}

// ============================================================
// BIND EVENTS
// ============================================================
function bindEvents() {
    if (authForm) authForm.onsubmit = (e) => { e.preventDefault(); const u = document.getElementById('usernameInput').value.trim(); if (u) loginWithUsername(u); };
    document.getElementById('googleLoginBtn')?.addEventListener('click', loginWithGoogle);
    document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
    document.getElementById('mobileLogoutBtn')?.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });

    const toggleAuth = document.getElementById('toggleAuthMode');
    if (toggleAuth) toggleAuth.onclick = (e) => { e.preventDefault(); authMode = authMode === 'login' ? 'register' : 'login'; updateAuthText(); };

    const openSettings = (e) => {
        if (e) e.preventDefault();
        if (settingsModal) settingsModal.style.display = 'flex';
        const av = (currentUser && localStorage.getItem(`pa_avatar_${currentUser.uid}`)) || currentUser?.photoURL || DEFAULT_AVATAR;
        const prev = document.getElementById('settingsAvatarPreview');
        if (prev) prev.src = av;
        if (document.getElementById('settingsAge')) document.getElementById('settingsAge').value = userProfile.age || '';
        if (document.getElementById('settingsTargetSys')) document.getElementById('settingsTargetSys').value = userProfile.targetSys || 120;
    };
    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    document.getElementById('mobileSettingsBtn')?.addEventListener('click', openSettings);

    document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
        const age = parseInt(document.getElementById('settingsAge')?.value) || null;
        const targetSys = parseInt(document.getElementById('settingsTargetSys')?.value) || 120;
        await saveUserProfile({ age, targetSys });
        showSync('✓ Perfil guardado', true);
        updateStatusCard();
    });

    // Reminder modal
    document.getElementById('reminderBtn')?.addEventListener('click', () => {
        if (reminderModal) reminderModal.style.display = 'flex';
    });
    document.getElementById('saveRemindersBtn')?.addEventListener('click', saveReminders);
    document.getElementById('clearRemindersBtn')?.addEventListener('click', () => {
        localStorage.removeItem('pa_reminder1');
        localStorage.removeItem('pa_reminder2');
        if (document.getElementById('reminder1Input')) document.getElementById('reminder1Input').value = '';
        if (document.getElementById('reminder2Input')) document.getElementById('reminder2Input').value = '';
        reminderModal.style.display = 'none';
        showSync('🔕 Recordatorios borrados', true);
    });

    // Photo input
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const src = ev.target.result;
                    if (currentUser) localStorage.setItem(`pa_avatar_${currentUser.uid}`, src);
                    const img = document.querySelector('.user-profile img');
                    if (img) img.src = src;
                    const prev = document.getElementById('settingsAvatarPreview');
                    if (prev) prev.src = src;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (themeToggle) themeToggle.onclick = () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
        updateThemeUI();
        if (myChart) updateChartTheme();
    };

    if (langSelect) langSelect.onchange = (e) => { currentLang = e.target.value; localStorage.setItem('lang', currentLang); applyTranslations(); };

    if (sidebarToggle) sidebarToggle.onclick = () => { sidebar.classList.toggle('collapsed'); if (myChart) setTimeout(() => myChart.resize(), 400); };

    // Chart filter buttons
    document.querySelectorAll('.chart-filters button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-filters button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            chartDays = parseInt(btn.dataset.days) || 7;
            initChart();
        });
    });

    // Real-time preview on entry form (mejora #1)
    const sysInput = document.getElementById('systolic');
    const diaInput = document.getElementById('diastolic');
    const previewEl = document.getElementById('entryClassPreview');
    const updatePreview = () => {
        const s = parseInt(sysInput?.value), d = parseInt(diaInput?.value);
        if (s > 0 && d > 0 && previewEl) {
            const cat = classifyBP(s, d);
            previewEl.innerHTML = `<span style="color:${cat.color}">● ${currentLang === 'es' ? cat.label : cat.labelEn}</span> — ${BP_DESCRIPTIONS[cat.key][currentLang]}`;
            previewEl.classList.remove('hidden');
        } else if (previewEl) previewEl.classList.add('hidden');
    };
    sysInput?.addEventListener('input', updatePreview);
    diaInput?.addEventListener('input', updatePreview);

    // Modal closing
    window.onclick = (e) => {
        if (e.target.closest('.close-modal') || e.target === entryModal || e.target === settingsModal || e.target === reminderModal) {
            if (entryModal) entryModal.style.display = 'none';
            if (settingsModal) settingsModal.style.display = 'none';
            if (reminderModal) reminderModal.style.display = 'none';
        }
    };

    bindOnboarding();
}

// ============================================================
// TRANSLATIONS & THEME
// ============================================================
function applyTranslations() {
    const texts = T[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n'); if (texts[k]) el.innerText = texts[k]; });
    if (langSelect) langSelect.value = currentLang;
    if (myChart) initChart();
    if (currentUser) updateUI();
    updateAuthText();
}
function updateAuthText() {
    const isLogin = authMode === 'login';
    const texts = T[currentLang];
    const el = (id) => document.getElementById(id);
    if (el('authSubtitle')) el('authSubtitle').innerText = texts.auth_welcome;
    if (el('authSubmitBtn')) el('authSubmitBtn').innerText = isLogin ? texts.btn_login : texts.btn_register;
    if (el('toggleText')) el('toggleText').innerText = isLogin ? texts.no_account : texts.has_account;
    if (el('toggleAuthMode')) el('toggleAuthMode').innerText = isLogin ? texts.create_user : texts.login_now;
}
function updateThemeUI() {
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('i');
    if (icon) { icon.setAttribute('data-lucide', currentTheme === 'dark' ? 'sun' : 'moon'); if (window.lucide) lucide.createIcons(); }
}

// ============================================================
// STATUS CARD (mejora #1)
// ============================================================
function updateStatusCard() {
    if (pressureData.length === 0) return;
    const last = pressureData[pressureData.length - 1];
    const cat = classifyBP(last.systolic, last.diastolic);
    const card = document.getElementById('statusCard');
    const label = document.getElementById('statusLabel');
    const desc  = document.getElementById('statusDesc');
    const badge = document.getElementById('statusBadge');
    if (!card) return;
    card.style.background = cat.bg;
    card.style.borderColor = cat.color + '40';
    if (label) { label.textContent = currentLang === 'es' ? cat.label : cat.labelEn; label.style.color = cat.color; }
    if (desc)  desc.textContent = BP_DESCRIPTIONS[cat.key][currentLang];
    if (badge) { badge.style.background = cat.color; badge.innerHTML = `<i data-lucide="${cat.icon}"></i>`; if (window.lucide) lucide.createIcons(); }
}

// ============================================================
// TREND HELPERS (mejora #2)
// ============================================================
function getTrend(arr, key) {
    if (arr.length < 2) return null;
    const recent = arr.slice(-Math.min(5, arr.length));
    const prev   = arr.slice(-Math.min(10, arr.length), -Math.min(5, arr.length));
    if (!prev.length) return null;
    const avgRecent = recent.reduce((a, b) => a + b[key], 0) / recent.length;
    const avgPrev   = prev.reduce((a, b) => a + b[key], 0) / prev.length;
    const diff = Math.round(avgRecent - avgPrev);
    return diff;
}

function renderTrend(elId, diff, lowerIsBetter = true) {
    const el = document.getElementById(elId);
    if (!el || diff === null) return;
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    const arrow = diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
    const cls   = diff === 0 ? '' : improved ? 'up' : 'down';
    const sign  = diff > 0 ? '+' : '';
    el.innerHTML = `<span class="stat-trend ${cls}">${arrow} ${sign}${diff} vs semana anterior</span>`;
}

// ============================================================
// SPARKLINES (mejora #2)
// ============================================================
const sparkInstances = {};
function drawSparkline(canvasId, data, color) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !data.length) return;
    if (sparkInstances[canvasId]) sparkInstances[canvasId].destroy();
    sparkInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, i) => i),
            datasets: [{ data, borderColor: color, borderWidth: 2, pointRadius: 0, fill: true,
                backgroundColor: color.replace('rgb', 'rgba').replace(')', ',0.15)'), tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } } }
    });
}

// ============================================================
// UI UPDATE
// ============================================================
function updateUI() {
    const hasData = pressureData.length > 0;
    if (emptyState) emptyState.classList.toggle('hidden', hasData);
    if (dashGrid) dashGrid.classList.toggle('hidden', !hasData);

    if (!hasData) return;

    const last = pressureData[pressureData.length - 1];

    // Stat values
    document.getElementById('lastVal')?.setAttribute && (document.getElementById('lastVal').innerText = `${last.systolic}/${last.diastolic}`);
    const avgSys = Math.round(pressureData.reduce((a, b) => a + b.systolic, 0) / pressureData.length);
    const avgDia = Math.round(pressureData.reduce((a, b) => a + b.diastolic, 0) / pressureData.length);
    document.getElementById('avgVal') && (document.getElementById('avgVal').innerText = `${avgSys}/${avgDia}`);
    document.getElementById('avgMeta') && (document.getElementById('avgMeta').innerText = `${pressureData.length} ${currentLang === 'es' ? 'lecturas' : 'readings'}`);
    const lastPulse = [...pressureData].filter(d => d.pulse).pop();
    document.getElementById('pulseVal') && (document.getElementById('pulseVal').innerText = lastPulse ? lastPulse.pulse : '--');

    // Trends
    renderTrend('trendLast', getTrend(pressureData, 'systolic'), true);
    renderTrend('trendAvg', getTrend(pressureData, 'systolic'), true);
    renderTrend('trendPulse', getTrend(pressureData.filter(d => d.pulse), 'pulse'), true);

    // Sparklines
    drawSparkline('sparkline1', pressureData.slice(-10).map(d => d.systolic), '#6366f1');
    drawSparkline('sparkline2', pressureData.slice(-10).map(d => d.diastolic), '#f43f5e');
    if (lastPulse) drawSparkline('sparkline3', pressureData.filter(d => d.pulse).slice(-10).map(d => d.pulse), '#10b981');

    // Status card
    updateStatusCard();

    // History table
    if (histBody) {
        histBody.innerHTML = '';
        [...pressureData].reverse().forEach(entry => {
            const cat = classifyBP(entry.systolic, entry.diastolic);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(entry.date)}</td>
                <td>${entry.time}</td>
                <td style="font-weight:600">${entry.systolic}/${entry.diastolic}</td>
                <td><span class="bp-badge" style="background:${cat.bg};color:${cat.color};border:1px solid ${cat.color}40">${currentLang === 'es' ? cat.label : cat.labelEn}</span></td>
                <td>${entry.pulse ? entry.pulse + ' BPM' : '---'}</td>
                <td style="font-size:0.85rem;opacity:0.8">${entry.notes || '-'}</td>
                <td><div class="row-actions">
                    <button class="btn-row-action edit" onclick="editEntry('${entry.firestoreId}')"><i data-lucide="edit-2"></i></button>
                    <button class="btn-row-action delete" onclick="deleteEntry('${entry.firestoreId}')"><i data-lucide="trash-2"></i></button>
                </div></td>`;
            histBody.appendChild(row);
        });
    }

    if (window.lucide) lucide.createIcons();
}

// ============================================================
// CHART
// ============================================================
let myChart;
function initChart() {
    const ctx = document.getElementById('pressureChart')?.getContext('2d');
    if (!ctx) return;
    if (myChart) myChart.destroy();
    const isDark = currentTheme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const cutoff = Date.now() - chartDays * 86400000;
    const filtered = pressureData.filter(d => {
        const ts = d.timestamp || new Date(d.date + 'T00:00:00').getTime();
        return ts >= cutoff;
    });
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: filtered.map(d => formatDate(d.date)),
            datasets: [
                { label: T[currentLang].systolic,  data: filtered.map(d => d.systolic),  borderColor: '#6366f1', borderWidth: 3, tension: 0.4, pointRadius: 4, fill: true, backgroundColor: 'rgba(99,102,241,0.1)' },
                { label: T[currentLang].diastolic, data: filtered.map(d => d.diastolic), borderColor: '#f43f5e', borderWidth: 3, tension: 0.4, pointRadius: 4, fill: true, backgroundColor: 'rgba(244,63,94,0.1)' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: textColor, font: { family: 'Outfit' } }, grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } },
                x: { ticks: { color: textColor, font: { family: 'Outfit' } }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: textColor, font: { family: 'Outfit', weight: '600' } } } }
        }
    });
}
function updateChartTheme() {
    if (!myChart) return;
    const clr = currentTheme === 'dark' ? '#94a3b8' : '#64748b';
    myChart.options.scales.y.ticks.color = clr;
    myChart.options.scales.x.ticks.color = clr;
    myChart.options.plugins.legend.labels.color = clr;
    myChart.update();
}

// ============================================================
// ENTRY MANAGEMENT
// ============================================================
if (entryForm) {
    entryForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = entryForm.querySelector('[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = T[currentLang].saving; }
        const systolic  = parseInt(document.getElementById('systolic').value);
        const diastolic = parseInt(document.getElementById('diastolic').value);
        const pulse     = document.getElementById('pulse').value ? parseInt(document.getElementById('pulse').value) : null;
        const notes     = document.getElementById('notes').value;
        try {
            if (editingId) {
                await updateMeasurement(editingId, { systolic, diastolic, pulse, notes });
                editingId = null;
            } else {
                await addMeasurement({ date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }), systolic, diastolic, pulse, notes });
            }
            entryModal.style.display = 'none';
            entryForm.reset();
            document.getElementById('entryClassPreview')?.classList.add('hidden');
        } catch(err) { console.error(err); alert('Error al guardar.'); }
        finally { if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = T[currentLang].save_entry; } }
    };
}

window.editEntry = (id) => {
    const e = pressureData.find(d => d.firestoreId === id);
    if (e) {
        editingId = id;
        document.getElementById('systolic').value  = e.systolic;
        document.getElementById('diastolic').value = e.diastolic;
        document.getElementById('pulse').value     = e.pulse || '';
        document.getElementById('notes').value     = e.notes || '';
        entryModal.style.display = 'flex';
    }
};
window.deleteEntry = async (id) => {
    if (confirm(T[currentLang].confirm_delete)) {
        try { await deleteMeasurement(id); } catch(err) { alert('Error al eliminar.'); }
    }
};

// ============================================================
// HELPERS
// ============================================================
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getFullYear()).slice(-2)}`;
}

window.selectAvatar = (src) => {
    if (currentUser) localStorage.setItem(`pa_avatar_${currentUser.uid}`, src);
    const img = document.querySelector('.user-profile img');
    if (img) img.src = src;
    const prev = document.getElementById('settingsAvatarPreview');
    if (prev) prev.src = src;
};

document.getElementById('newEntryBtn')?.addEventListener('click', () => {
    editingId = null;
    if (entryForm) entryForm.reset();
    document.getElementById('entryClassPreview')?.classList.add('hidden');
    entryModal.style.display = 'flex';
});

document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const docPdf = new jsPDF();
    docPdf.setFontSize(16);
    docPdf.text('PresionApp — Reporte de Presión Arterial', 10, 15);
    if (userProfile.age) { docPdf.setFontSize(10); docPdf.text(`Paciente: ${currentUser?.displayName || ''} | Edad: ${userProfile.age} años`, 10, 23); }
    docPdf.autoTable({
        startY: 28,
        head: [[T[currentLang].date, T[currentLang].time, 'mmHg', 'Estado', 'BPM', T[currentLang].notes]],
        body: pressureData.map(d => {
            const cat = classifyBP(d.systolic, d.diastolic);
            return [formatDate(d.date), d.time, `${d.systolic}/${d.diastolic}`, currentLang === 'es' ? cat.label : cat.labelEn, d.pulse || '-', d.notes || ''];
        }),
        styles: { fontSize: 9 }
    });
    docPdf.save('Reporte_Presion.pdf');
});
