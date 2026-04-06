import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get, update, push, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- КОНФИГУРАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyASOKVgbFNStdieGXpbMuVVX3Y8P7NlY6Y",
    authDomain: "killa-c8794.firebaseapp.com",
    databaseURL: "https://killa-c8794-default-rtdb.firebaseio.com",
    projectId: "killa-c8794",
    storageBucket: "killa-c8794.firebasestorage.app",
    messagingSenderId: "209292210267",
    appId: "1:209292210267:web:b320358f45a21ad1284f7e",
    measurementId: "G-BFYYQELE6C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const roleStyles = {
    'Developer': { color: '#3eafff', level: 6 },
    'Owner': { color: '#ff3e3e', level: 5 },
    'Dep.Owner': { color: '#ff7e3e', level: 4 },
    'Крутой поц': { color: '#ae70ff', level: 3 },
    'Member': { color: '#888', level: 1 }
};

// --- АВТОРИЗАЦИЯ ---
window.toggleAuthMode = () => {
    const title = document.getElementById('modal-title');
    const nick = document.getElementById('auth-nickname');
    const btn = document.getElementById('auth-submit-btn');
    if (nick.style.display === 'none' || nick.style.display === '') {
        title.innerText = "SYSTEM REGISTRATION";
        nick.style.display = 'block';
        btn.innerText = "CREATE ACCOUNT";
    } else {
        title.innerText = "SYSTEM ACCESS";
        nick.style.display = 'none';
        btn.innerText = "CONFIRM";
    }
};

window.handleAuth = async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-password').value;
    const nick = document.getElementById('auth-nickname').value;
    const isReg = document.getElementById('auth-nickname').style.display === 'block';
    try {
        if (isReg) {
            const res = await createUserWithEmailAndPassword(auth, email, pass);
            await set(ref(db, 'users/' + res.user.uid), {
                name: nick || email.split('@')[0],
                role: 'Member',
                id: Math.floor(1000 + Math.random() * 9000),
                avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=' + res.user.uid
            });
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
    } catch (e) { alert("Ошибка: " + e.message); }
};

// --- НАБЛЮДАТЕЛЬ (AUTH OBSERVER) ---
onAuthStateChanged(auth, async (user) => {
    const authBtn = document.getElementById('auth-btn');
    const chatTab = document.getElementById('chat-tab-btn');
    const modal = document.getElementById('auth-modal');

    if (user) {
        modal.style.display = 'none';
        const snap = await get(ref(db, 'users/' + user.uid));
        const data = snap.val();
        if (data) {
            const userStatusRef = ref(db, 'status/' + user.uid);
            set(userStatusRef, { name: data.name, online: true, role: data.role });
            onDisconnect(userStatusRef).remove();

            authBtn.innerText = data.name.toUpperCase();
            document.getElementById('user-display-name').innerText = data.name;
            document.getElementById('user-id-number').innerText = data.id;
            document.getElementById('user-role-badge').innerText = data.role;
            document.getElementById('user-role-badge').style.color = roleStyles[data.role]?.color || '#888';
            document.getElementById('user-avatar-display').src = data.avatar || '';
            document.getElementById('security-level').innerText = 'LVL ' + (roleStyles[data.role]?.level || 1);
            chatTab.style.display = 'inline-block';
            
            window.showTab(null, 'news-section');
        }
    } else {
        modal.style.display = 'flex';
        authBtn.innerText = "ACCESS";
        chatTab.style.display = 'none';
    }
});

// --- ЗВЕЗДНЫЙ ФОН ---
function initStars() {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();
    for(let i=0; i<150; i++) stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, size: Math.random()*2, speed: Math.random()*0.5+0.1 });
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#3eafff';
        stars.forEach(s => {
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
            s.y += s.speed; if(s.y > canvas.height) s.y = 0;
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// --- СПИСОК АДМИНИСТРАЦИИ ---
onValue(ref(db, 'status'), (snap) => {
    const countEl = document.getElementById('live-users-count');
    countEl.innerText = snap.size || 0;

    // Ищем Owner и Dep.Owner в INFO секции или создадим блок
    const infoSec = document.getElementById('info-section');
    let adminList = document.getElementById('admin-online-list');
    if (!adminList) {
        adminList = document.createElement('div');
        adminList.id = 'admin-online-list';
        adminList.className = 'card';
        adminList.innerHTML = '<h4>MANAGEMENT ONLINE</h4><div id="admins-cont"></div>';
        infoSec.appendChild(adminList);
    }
    
    const cont = document.getElementById('admins-cont');
    cont.innerHTML = '';
    snap.forEach(child => {
        const u = child.val();
        if (u.role === 'Owner' || u.role === 'Dep.Owner') {
            const color = roleStyles[u.role].color;
            cont.innerHTML += `<p style="color:${color}; cursor:pointer" onclick="viewUserProfile('${child.key}')">● ${u.name} (${u.role})</p>`;
        }
    });
});

// --- ПРОФИЛИ И ПОДПИСКИ ---
window.viewUserProfile = async (uid) => {
    const snap = await get(ref(db, 'users/' + uid));
    const data = snap.val();
    if (!data) return;

    document.getElementById('view-name').innerText = data.name;
    document.getElementById('view-avatar').src = data.avatar || '';
    document.getElementById('view-role').innerText = data.role;
    document.getElementById('view-role').style.color = roleStyles[data.role]?.color || '#888';
    document.getElementById('view-id').innerText = data.id;

    const modal = document.getElementById('user-profile-modal');
    modal.style.display = 'flex';

    const btn = document.getElementById('follow-btn');
    if (auth.currentUser && uid !== auth.currentUser.uid) {
        btn.style.display = 'block';
        const followRef = ref(db, `follows/${auth.currentUser.uid}/${uid}`);
        const fSnap = await get(followRef);
        btn.innerText = fSnap.exists() ? "UNFOLLOW" : "FOLLOW";
        btn.onclick = () => window.toggleFollow(uid);
    } else {
        btn.style.display = 'none';
    }
};

window.toggleFollow = async (targetUid) => {
    const followRef = ref(db, `follows/${auth.currentUser.uid}/${targetUid}`);
    const snap = await get(followRef);
    if (snap.exists()) {
        await set(followRef, null);
    } else {
        await set(followRef, true);
    }
    window.viewUserProfile(targetUid); // Обновить кнопку
};

// --- ОСТАЛЬНОЕ ---
window.showTab = (e, id) => {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (e) e.currentTarget.classList.add('active');
    
    const zone = document.getElementById('chat-input-zone');
    zone.style.display = (auth.currentUser && (id === 'chat-section' || id === 'news-section')) ? 'block' : 'none';
};

window.handleSend = async () => {
    const input = document.getElementById('chat-msg-input');
    if (!input.value.trim()) return;
    const userData = (await get(ref(db, 'users/' + auth.currentUser.uid))).val();
    const path = document.getElementById('chat-section').style.display === 'block' ? 'chat_messages' : 'posts';
    
    await push(ref(db, path), {
        text: input.value,
        author: userData.name,
        uid: auth.currentUser.uid,
        role: userData.role,
        timestamp: Date.now()
    });
    input.value = '';
};

onValue(ref(db, 'chat_messages'), snap => {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    box.innerHTML = '';
    snap.forEach(c => {
        const m = c.val();
        box.innerHTML += `<div><b style="color:${roleStyles[m.role]?.color}; cursor:pointer" onclick="viewUserProfile('${m.uid}')">${m.author}:</b> ${m.text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

onValue(ref(db, 'posts'), snap => {
    const cont = document.getElementById('news-container');
    if (!cont) return;
    cont.innerHTML = '';
    let arr = []; snap.forEach(c => arr.push(c.val()));
    arr.reverse().forEach(p => {
        cont.innerHTML += `<div class="card" style="border-left:3px solid ${roleStyles[p.role]?.color}"><small onclick="viewUserProfile('${p.uid}')" style="cursor:pointer; color:${roleStyles[p.role]?.color}">${p.author}</small><p>${p.text}</p></div>`;
    });
});

window.handleLogout = () => signOut(auth).then(() => location.reload());
window.openAuthModal = () => auth.currentUser ? window.showTab(null, 'cabinet-section') : document.getElementById('auth-modal').style.display = 'flex';
window.closeAuthModal = () => auth.currentUser ? document.getElementById('auth-modal').style.display = 'none' : alert("Login required");
window.autoResize = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
window.toggleInputZone = () => {
    const z = document.getElementById('chat-input-zone');
    z.classList.toggle('minimized');
    z.querySelector('.toggle-input-btn').innerText = z.classList.contains('minimized') ? '+' : '–';
};

window.addEventListener('load', () => {
    initStars();
    setTimeout(() => {
        const l = document.getElementById('initial-loader');
        if(l) { l.style.opacity = '0'; setTimeout(() => l.style.display='none', 800); }
    }, 1000);
});
