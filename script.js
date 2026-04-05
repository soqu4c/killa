import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, get, update, push, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
    };;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const roleStyles = {
    'Developer': { color: '#3eafff', level: 6 },
    'Owner': { color: '#ff3e3e', level: 5 },
    'Крутой поц': { color: '#ae70ff', level: 3 },
    'Member': { color: '#888', level: 1 }
};

// --- АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ---
window.toggleAuthMode = () => {
    const title = document.getElementById('modal-title');
    const nick = document.getElementById('auth-nickname');
    const btn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');

    if (nick.style.display === 'none') {
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
    const isReg = document.getElementById('auth-nickname').style.display !== 'none';

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
        window.closeAuthModal();
    } catch (e) { 
        alert("Ошибка доступа: " + e.message); 
    }
};

// --- НАБЛЮДАТЕЛЬ ЗА СОСТОЯНИЕМ (AUTH OBSERVER) ---
onAuthStateChanged(auth, async (user) => {
    const authBtn = document.getElementById('auth-btn');
    const chatTab = document.getElementById('chat-tab-btn');
    const welcomeOverlay = document.getElementById('global-welcome');

    if (user) {
        // Закрываем модалку, если она открыта
        window.closeAuthModal();
        
        const snap = await get(ref(db, 'users/' + user.uid));
        const data = snap.val();
        
        if (data) {
            authBtn.innerText = data.name.toUpperCase();
            document.getElementById('user-display-name').innerText = data.name;
            document.getElementById('user-id-number').innerText = data.id;
            document.getElementById('user-role-badge').innerText = data.role;
            document.getElementById('user-role-badge').style.color = roleStyles[data.role]?.color || '#888';
            document.getElementById('user-avatar-display').src = data.avatar || '';
            document.getElementById('security-level').innerText = 'LVL ' + (roleStyles[data.role]?.level || 1);
            
            chatTab.style.display = 'inline-block';
            
            // Персональное приветствие (раз в сессию)
            if (!sessionStorage.getItem('logged_in')) {
                document.getElementById('user-display-name-global').innerText = data.name.toUpperCase();
                welcomeOverlay.style.display = 'flex';
                setTimeout(() => { welcomeOverlay.style.display = 'none'; }, 3000);
                sessionStorage.setItem('logged_in', 'true');
            }
        }
    } else {
        authBtn.innerText = "ACCESS";
        chatTab.style.display = 'none';
        sessionStorage.removeItem('logged_in');
        // Если разлогинились, уходим с секретных вкладок
        const currentTab = document.querySelector('.tab-btn.active')?.innerText;
        if (currentTab === 'CHAT' || currentTab === 'PROFILE') {
            window.showTab(null, 'news-section');
        }
    }
});

// --- УПРАВЛЕНИЕ ВКЛАДКАМИ ---
window.showTab = (event, tabId) => {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');

    const inputZone = document.getElementById('chat-input-zone');
    // Показываем поле ввода только если юзер вошел и находится в чате или новостях
    if (auth.currentUser && (tabId === 'chat-section' || tabId === 'news-section')) {
        inputZone.style.display = 'block';
    } else {
        inputZone.style.display = 'none';
    }
};

// --- МОДАЛЬНЫЕ ОКНА ---
window.openAuthModal = () => {
    if (auth.currentUser) {
        window.showTab(null, 'cabinet-section');
    } else {
        document.getElementById('auth-modal').style.display = 'flex';
    }
};

window.closeAuthModal = () => {
    document.getElementById('auth-modal').style.display = 'none';
};

window.handleLogout = () => {
    signOut(auth).then(() => location.reload());
};

// --- ЧАТ И ОТПРАВКА ---
window.autoResize = (t) => {
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
};

window.handleSend = async () => {
    const input = document.getElementById('chat-msg-input');
    if (!input.value.trim() || !auth.currentUser) return;

    const snap = await get(ref(db, 'users/' + auth.currentUser.uid));
    const userData = snap.val();
    const isChat = document.getElementById('chat-section').style.display === 'block';

    await push(ref(db, isChat ? 'chat_messages' : 'posts'), {
        text: input.value,
        author: userData.name,
        role: userData.role,
        timestamp: Date.now()
    });

    input.value = '';
    input.style.height = 'auto';
};

// --- РЕАЛЬНОЕ ВРЕМЯ (СЛУШАТЕЛИ БД) ---
onValue(ref(db, 'chat_messages'), snap => {
    const box = document.getElementById('chat-messages');
    box.innerHTML = '';
    snap.forEach(child => {
        const m = child.val();
        const color = roleStyles[m.role]?.color || '#888';
        box.innerHTML += `<div><b style="color:${color}">${m.author}:</b> ${m.text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
});

onValue(ref(db, 'posts'), snap => {
    const cont = document.getElementById('news-container');
    cont.innerHTML = '';
    let posts = [];
    snap.forEach(c => { posts.push(c.val()); });
    posts.reverse().forEach(p => {
        const color = roleStyles[p.role]?.color || '#888';
        cont.innerHTML += `
            <div class="card" style="border-left: 3px solid ${color}; margin-bottom: 15px;">
                <small style="color:${color}; font-weight: 900;">${p.author.toUpperCase()}</small>
                <p style="margin-top: 10px;">${p.text}</p>
            </div>`;
    });
});

// --- ВИЗУАЛЬНЫЕ ЭФФЕКТЫ ---

// Начальный загрузчик
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('initial-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 800);
        }
    }, 1500);
});

// Анимация звезд
const canvas = document.getElementById('stars-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let stars = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); 
    resize();

    for(let i=0; i<150; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#3eafff';
        stars.forEach(s => {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
            s.y += s.speed;
            if(s.y > canvas.height) s.y = 0;
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// Сворачивание инпута
window.toggleInputZone = () => {
    const zone = document.getElementById('chat-input-zone');
    const btn = zone.querySelector('.toggle-input-btn');
    
    zone.classList.toggle('minimized');
    
    // Меняем иконку, чтобы было понятно, что делать
    if (zone.classList.contains('minimized')) {
        btn.innerText = '+';
    } else {
        btn.innerText = '–';
    }
};
