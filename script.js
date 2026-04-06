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
    const toggleText = document.getElementById('auth-toggle-text');

    if (nick.style.display === 'none' || nick.style.display === '') {
        title.innerText = "SYSTEM REGISTRATION";
        nick.style.display = 'block';
        btn.innerText = "CREATE ACCOUNT";
        toggleText.innerText = "Уже есть аккаунт? Войти";
    } else {
        title.innerText = "SYSTEM ACCESS";
        nick.style.display = 'none';
        btn.innerText = "CONFIRM";
        toggleText.innerText = "Регистрация";
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
        document.getElementById('auth-modal').style.display = 'none';
    } catch (e) { 
        alert("Ошибка доступа: " + e.message); 
    }
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
            set(userStatusRef, { name: data.name, online: true });
            onDisconnect(userStatusRef).remove();

            authBtn.innerText = data.name.toUpperCase();
            document.getElementById('user-display-name').innerText = data.name;
            document.getElementById('user-id-number').innerText = data.id;
            document.getElementById('user-role-badge').innerText = data.role;
            document.getElementById('user-role-badge').style.color = roleStyles[data.role]?.color || '#888';
            document.getElementById('user-avatar-display').src = data.avatar || '';
            document.getElementById('security-level').innerText = 'LVL ' + (roleStyles[data.role]?.level || 1);
            
            chatTab.style.display = 'inline-block';
            
            const activeBtn = document.querySelector('.tab-btn.active');
            const currentTabId = activeBtn?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 'news-section';
            window.showTab(null, currentTabId);
        }
    } else {
        modal.style.display = 'flex';
        if (authBtn) authBtn.innerText = "ACCESS";
        if (chatTab) chatTab.style.display = 'none';
        const inputZone = document.getElementById('chat-input-zone');
        if (inputZone) inputZone.style.display = 'none';
    }
});

// Счетчик пользователей
onValue(ref(db, 'status'), (snapshot) => {
    const count = snapshot.size || 0;
    const counterElement = document.getElementById('live-users-count');
    if (counterElement) counterElement.innerText = count;
});

// --- ВКЛАДКИ ---
window.showTab = (event, tabId) => {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');

    const inputZone = document.getElementById('chat-input-zone');
    if (auth.currentUser && (tabId === 'chat-section' || tabId === 'news-section')) {
        inputZone.style.display = 'block';
    } else {
        inputZone.style.display = 'none';
    }
};

window.openAuthModal = () => {
    if (auth.currentUser) {
        window.showTab(null, 'cabinet-section');
    } else {
        document.getElementById('auth-modal').style.display = 'flex';
    }
};

window.closeAuthModal = () => {
    if (!auth.currentUser) {
        alert("Требуется авторизация в системе KILLA");
        return;
    }
    document.getElementById('auth-modal').style.display = 'none';
};

window.handleLogout = () => {
    signOut(auth).then(() => location.reload());
};

// --- СООБЩЕНИЯ И НОВОСТИ ---
window.handleSend = async () => {
    const input = document.getElementById('chat-msg-input');
    if (!input.value.trim() || !auth.currentUser) return;

    const snap = await get(ref(db, 'users/' + auth.currentUser.uid));
    const userData = snap.val();
    const isChat = document.getElementById('chat-section').style.display === 'block';

    await push(ref(db, isChat ? 'chat_messages' : 'posts'), {
        text: input.value,
        author: userData.name,
        uid: auth.currentUser.uid, // Добавляем UID для кликабельности
        role: userData.role,
        timestamp: Date.now()
    });

    input.value = '';
};

onValue(ref(db, 'chat_messages'), snap => {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    box.innerHTML = '';
    snap.forEach(child => {
        const m = child.val();
        const color = roleStyles[m.role]?.color || '#888';
        // Делаем ник кликабельным
        box.innerHTML += `<div><b style="color:${color}; cursor:pointer" onclick="viewUserProfile('${m.uid}')">${m.author}:</b> ${m.text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

onValue(ref(db, 'posts'), snap => {
    const cont = document.getElementById('news-container');
    if (!cont) return;
    cont.innerHTML = '';
    let posts = [];
    snap.forEach(c => { posts.push({ ...c.val(), id: c.key }); });
    posts.reverse().forEach(p => {
        const color = roleStyles[p.role]?.color || '#888';
        cont.innerHTML += `
            <div class="card" style="border-left: 3px solid ${color}; margin-bottom: 15px;">
                <small style="color:${color}; font-weight: 900; cursor:pointer" onclick="viewUserProfile('${p.uid}')">${p.author.toUpperCase()}</small>
                <p style="margin-top: 10px;">${p.text}</p>
            </div>`;
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
        btn.onclick = () => window.toggleFollow(uid);
    } else {
        btn.style.display = 'none';
    }
};

window.toggleFollow = async (targetUid) => {
    if (!auth.currentUser) return;
    const followRef = ref(db, `follows/${auth.currentUser.uid}/${targetUid}`);
    const snap = await get(followRef);

    if (snap.exists()) {
        await set(followRef, null);
        alert("UNFOLLOWED");
    } else {
        await set(followRef, true);
        alert("FOLLOWING ACQUIRED");
    }
};

// --- ВСПОМОГАТЕЛЬНОЕ ---
window.autoResize = (t) => {
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
};

window.toggleInputZone = () => {
    const zone = document.getElementById('chat-input-zone');
    zone.classList.toggle('minimized');
    zone.querySelector('.toggle-input-btn').innerText = zone.classList.contains('minimized') ? '+' : '–';
};

window.setAvatar = async (url) => {
    if (auth.currentUser) {
        await update(ref(db, 'users/' + auth.currentUser.uid), { avatar: url });
        document.getElementById('user-avatar-display').src = url;
    }
};

window.uploadAvatar = (input) => {
    const reader = new FileReader();
    reader.onload = (e) => window.setAvatar(e.target.result);
    if (input.files[0]) reader.readAsDataURL(input.files[0]);
};

window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('initial-loader');
        if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 800); }
    }, 1000);
});
