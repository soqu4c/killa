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
            const preview = document.getElementById('avatar-preview-live');
            if (preview) preview.src = data.avatar || '';
            document.getElementById('security-level').innerText = 'LVL ' + (roleStyles[data.role]?.level || 1);
            chatTab.style.display = 'inline-block';

            // Загружаем кастомный статус
            loadCustomStatus();

            onValue(ref(db, `follows/${user.uid}`), (s) => {
                let followingCount = s.exists() ? Object.keys(s.val()).length : 0;
                const el = document.getElementById('user-following-count');
                if(el) el.innerText = followingCount;
            });

            let fCount = 0;

            onValue(ref(db, 'follows'), (s) => {
                fCount = 0;
                s.forEach((uF) => { if (uF.hasChild(user.uid)) fCount++; });
                const el = document.getElementById('user-followers-count');
                if(el) el.innerText = fCount;
            });

            // Activity score
            const activityEl = document.getElementById('activity-score');
            if (activityEl) {
                onValue(ref(db, 'posts'), (snap) => {
                    let userPosts = 0;
                    if (snap.exists()) {
                        snap.forEach(c => {
                            if (c.val().uid === user.uid) userPosts++;
                        });
                    }
                    const score = userPosts * 10 + fCount * 2;
                    activityEl.innerText = score;
                });
                
                // Обновляем при изменении follows
                onValue(ref(db, 'follows'), () => {
                    onValue(ref(db, 'posts'), (snap2) => {
                        let userPosts = 0;
                        if (snap2.exists()) {
                            snap2.forEach(c => {
                                if (c.val().uid === user.uid) userPosts++;
                            });
                        }
                        activityEl.innerText = userPosts * 10 + fCount * 2;
                    });
                });
            }

            const activeBtn = document.querySelector('.tab-btn.active');
            const currentTabId = activeBtn?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || 'news-section';
            window.showTab(null, currentTabId);
        }
    } else {
        modal.style.display = 'flex';
        authBtn.innerText = "ACCESS";
        chatTab.style.display = 'none';
    }
});

// --- ЗВЕЗДНЫЙ ФОН (С РЕАКЦИЕЙ НА МЫШЬ) ---
let starsMouseX = 0, starsMouseY = 0;

function initStars() {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();

    document.addEventListener('mousemove', (e) => {
        starsMouseX = e.clientX;
        starsMouseY = e.clientY;
    });

    for(let i=0; i<200; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1,
            originalX: 0,
            originalY: 0
        });
        stars[i].originalX = stars[i].x;
        stars[i].originalY = stars[i].y;
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        stars.forEach(s => {
            // Реакция звёзд на мышь
            const dx = s.x - starsMouseX;
            const dy = s.y - starsMouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 150;
            
            let drawX = s.x;
            let drawY = s.y;
            let drawSize = s.size;
            let drawOpacity = 1;

            if (dist < maxDist) {
                const force = (maxDist - dist) / maxDist;
                const angle = Math.atan2(dy, dx);
                drawX = s.x + Math.cos(angle) * force * 30;
                drawY = s.y + Math.sin(angle) * force * 30;
                drawSize = s.size + force * 2;
                drawOpacity = 0.5 + force * 0.5;
            }

            ctx.beginPath();
            ctx.arc(drawX, drawY, drawSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(62, 175, 255, ${drawOpacity})`;
            ctx.fill();

            s.y += s.speed;
            if (s.y > canvas.height) {
                s.y = 0;
                s.x = Math.random() * canvas.width;
                s.originalX = s.x;
                s.originalY = 0;
            }
        });

        // Соединительные линии между близкими звёздами
        ctx.strokeStyle = 'rgba(62, 175, 255, 0.05)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < stars.length; i++) {
            for (let j = i + 1; j < stars.length; j++) {
                const dx = stars[i].x - stars[j].x;
                const dy = stars[i].y - stars[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 80) {
                    ctx.beginPath();
                    ctx.moveTo(stars[i].x, stars[i].y);
                    ctx.lineTo(stars[j].x, stars[j].y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(animate);
    }
    animate();
}

// --- ЭФФЕКТЫ МЫШКИ ---
function initMouseEffects() {
    const cursorDot = document.createElement('div');
    cursorDot.className = 'cursor-dot';
    document.body.appendChild(cursorDot);

    const cursorRing = document.createElement('div');
    cursorRing.className = 'cursor-ring';
    document.body.appendChild(cursorRing);

    const mouseGlow = document.createElement('div');
    mouseGlow.className = 'mouse-glow';
    document.body.appendChild(mouseGlow);

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;
    let glowX = 0, glowY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function addHoverListeners() {
        document.querySelectorAll('button, .tab-btn, .card, .av-opt, .admin-item, .upload-label, .logout-btn, .auth-submit, .auth-switch, .send-trigger, .toggle-input-btn, a, label, input[type="file"]').forEach(el => {
            el.addEventListener('mouseenter', () => cursorRing.classList.add('hover'));
            el.addEventListener('mouseleave', () => cursorRing.classList.remove('hover'));
        });
    }
    addHoverListeners();

    function animateCursor() {
        const ringSpeed = 0.15;
        ringX += (mouseX - ringX) * ringSpeed;
        ringY += (mouseY - ringY) * ringSpeed;
        cursorRing.style.transform = `translate(${ringX - 14}px, ${ringY - 14}px)`;
        cursorDot.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    function animateGlow() {
        const glowSpeed = 0.08;
        glowX += (mouseX - glowX) * glowSpeed;
        glowY += (mouseY - glowY) * glowSpeed;
        mouseGlow.style.transform = `translate(${glowX - 200}px, ${glowY - 200}px)`;
        requestAnimationFrame(animateGlow);
    }
    animateGlow();

    // 3D наклон карточек
    function addTiltToCard(card) {
        if (card.dataset.tiltInitialized) return;
        card.dataset.tiltInitialized = 'true';
        
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
        });
    }

    document.querySelectorAll('.card').forEach(addTiltToCard);

    // Параллакс логотипа
    const logo = document.querySelector('.logo');
    document.addEventListener('mousemove', (e) => {
        const x = (e.clientX - window.innerWidth / 2) / 50;
        const y = (e.clientY - window.innerHeight / 2) / 50;
        if (logo) logo.style.transform = `translate(${x}px, ${y}px)`;
    });

    // Отслеживание динамического контента
    const observer = new MutationObserver(() => {
        addHoverListeners();
        document.querySelectorAll('.card').forEach(addTiltToCard);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// --- СПИСОК АДМИНИСТРАЦИИ ---
onValue(ref(db, 'status'), (snap) => {
    const countEl = document.getElementById('live-users-count');
    if(countEl) countEl.innerText = snap.size || 0;
});

onValue(ref(db, 'users'), (snap) => {
    const cont = document.getElementById('admins-cont');
    if (!cont) return;
    cont.innerHTML = '';

    snap.forEach(child => {
        const u = child.val();
        if (u.role === 'Owner' || u.role === 'Dep.Owner' || u.role === 'Developer') {
            const color = roleStyles[u.role]?.color || '#fff';
            cont.innerHTML += `
                <div class="admin-item" style="border-left: 2px solid ${color}; padding-left: 10px; margin: 10px 0; cursor: pointer;" onclick="viewUserProfile('${child.key}')">
                    <div style="color: ${color}; font-weight: bold;">${u.name.toUpperCase()}</div>
                    <div style="font-size: 10px; opacity: 0.6;">${u.role}</div>
                </div>
            `;
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

    const secEl = document.getElementById('view-security');
    if(secEl) secEl.innerText = 'LVL ' + (roleStyles[data.role]?.level || 1);

    const modal = document.getElementById('user-profile-modal');
    modal.style.display = 'flex';

    const btn = document.getElementById('follow-btn');
    if (auth.currentUser && uid !== auth.currentUser.uid) {
        btn.style.display = 'block';
        const followRef = ref(db, `follows/${auth.currentUser.uid}/${uid}`);
        const fSnap = await get(followRef);
        btn.innerText = fSnap.exists() ? "UNFOLLOW" : "FOLLOW";
        btn.onclick = (e) => {
            e.stopPropagation();
            window.toggleFollow(uid);
        };
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
    } else {
        await set(followRef, true);
    }
    window.viewUserProfile(targetUid);
};

// --- ВКЛАДКИ ---
window.showTab = (e, id) => {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (e) e.currentTarget.classList.add('active');

    const zone = document.getElementById('chat-input-zone');
    if(zone) {
        zone.style.display = (auth.currentUser && (id === 'chat-section' || id === 'news-section')) ? 'block' : 'none';
    }
};

window.handleSend = async () => {
    const input = document.getElementById('chat-msg-input');
    alert('handleSend вызван | input=' + !!input + ' | value="' + (input?.value || 'null') + '" | auth=' + !!auth.currentUser);

    if (!input) return;
    if (!input.value.trim()) { alert('Пустое сообщение'); return; }
    if (!auth.currentUser) { alert('Нужно войти!'); return; }

    try {
        const snap = await get(ref(db, 'users/' + auth.currentUser.uid));
        alert('User snap exists: ' + snap.exists());
        if (!snap.exists()) { alert('User не найден в БД'); return; }
        const userData = snap.val();

        const newsSection = document.getElementById('news-section');
        const chatSection = document.getElementById('chat-section');
        const isNewsVisible = newsSection && newsSection.style.display === 'block';
        const isChatVisible = chatSection && chatSection.style.display === 'block';
        const path = isNewsVisible ? 'posts' : (isChatVisible ? 'chat_messages' : 'posts');

        alert('Отправляю в: ' + path);

        const postData = {
            text: input.value,
            author: userData.name,
            uid: auth.currentUser.uid,
            role: userData.role,
            customStatus: userData.customStatus || '',
            timestamp: Date.now()
        };

        const newPostRef = push(ref(db, path));
        await set(newPostRef, postData);

        input.value = '';
        autoResize(input);
        alert('Отправлено!');
    } catch (err) {
        alert('Ошибка: ' + err.code + ' | ' + err.message);
    }
};

onValue(ref(db, 'chat_messages'), snap => {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    box.innerHTML = '';
    snap.forEach(c => {
        const m = c.val();
        const color = roleStyles[m.role]?.color || '#888';
        const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
        const status = m.customStatus ? `<span style="color:#444; font-size:10px; font-style:italic;"> • ${m.customStatus}</span>` : '';
        box.innerHTML += `
            <div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px; flex-wrap:wrap;">
                    <b style="color:${color}; cursor:pointer" onclick="viewUserProfile('${m.uid}')">${m.author}</b>
                    <span style="font-size:10px; color:#333; font-family:monospace;">${time}</span>
                    ${status}
                </div>
                <div style="color:#bbb; line-height:1.5;">${m.text}</div>
            </div>`;
    });
    box.scrollTop = box.scrollHeight;
});

onValue(ref(db, 'posts'), snap => {
    const cont = document.getElementById('news-container');
    if (!cont) return;
    cont.style.display = 'block';
    cont.style.border = '2px solid red';
    cont.style.padding = '10px';
    cont.innerHTML = '';
    let arr = [];
    snap.forEach(c => arr.push({ ...c.val(), id: c.key }));
    arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (arr.length === 0) {
        cont.innerHTML = '<p style="text-align:center;color:#333;padding:30px;">No posts yet</p>';
        return;
    }

    arr.forEach((p, i) => {
        const color = roleStyles[p.role]?.color || '#888';
        const time = p.timestamp ? new Date(p.timestamp).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        }) : '';
        const status = p.customStatus ? `<span style="color:#555; font-size:10px; font-style:italic; margin-left:8px;">${p.customStatus}</span>` : '';
        const card = document.createElement('div');
        card.className = 'card site-news-card';
        card.setAttribute('data-type', 'site');
        card.style.cssText = `display:block; border-left:4px solid ${color}; opacity:1 !important; transform:none !important; animation:none !important; background:rgba(20,20,30,0.95); border:1px solid #444; padding:20px; margin-bottom:15px; color:#fff; border-radius:8px; position:relative; z-index:9999;`;
        card.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <small onclick="viewUserProfile('${p.uid}')" style="cursor:pointer; color:${color}; font-weight:bold; font-size:11px; letter-spacing:1px; text-transform:uppercase;">${p.author.toUpperCase()}</small>
                    ${status}
                </div>
                <span style="font-size:10px; color:#666; font-family:monospace;">${time}</span>
            </div>
            <p style="margin-top:10px; color:#eee; line-height:1.6; font-size:15px;">${p.text}</p>`;
        cont.appendChild(card);
    });
});

window.handleLogout = () => signOut(auth).then(() => location.reload());
window.openAuthModal = () => auth.currentUser ? window.showTab(null, 'cabinet-section') : document.getElementById('auth-modal').style.display = 'flex';
window.closeAuthModal = () => {
    if (!auth.currentUser) {
        alert("ACCESS REQUIRED");
        return;
    }
    document.getElementById('auth-modal').style.display = 'none';
};

window.autoResize = (t) => {
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
};

// Отправка по Enter
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        const input = document.getElementById('chat-msg-input');
        const zone = document.getElementById('chat-input-zone');
        if (input && document.activeElement === input && zone && zone.style.display !== 'none' && input.value.trim()) {
            e.preventDefault();
            window.handleSend();
        }
    }
});

window.toggleInputZone = () => {
    const z = document.getElementById('chat-input-zone');
    z.classList.toggle('minimized');
    z.querySelector('.toggle-input-btn').innerText = z.classList.contains('minimized') ? '+' : '–';
};

window.setAvatar = async (url) => {
    if (auth.currentUser) {
        await update(ref(db, 'users/' + auth.currentUser.uid), { avatar: url });
        document.getElementById('user-avatar-display').src = url;
        const preview = document.getElementById('avatar-preview-live');
        if (preview) preview.src = url;
    }
};

window.uploadAvatar = (input) => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500000) { alert("Файл слишком большой! Лимит 500Кб."); return; }
    const reader = new FileReader();
    reader.onload = (e) => window.setAvatar(e.target.result);
    reader.readAsDataURL(file);
};

// === TELEGRAM FEED ===
const TG_CHANNELS = [
    { name: 'Zeus', url: 'zeuskilla' },
    { name: 'Lee Long', url: 'staslong' },
    { name: 'Pofibuem', url: 'pofibuem' },
];

let tgFeedRefreshInterval = null;

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

function extractPhotoUrl(post) {
    let imgUrl = '';

    // 1. Фото — background-image style
    const photoDiv = post.querySelector('.tgme_widget_message_photo');
    if (photoDiv) {
        const style = photoDiv.getAttribute('style') || '';
        const match = style.match(/url\(["']?([^"')\s]+)/);
        if (match) {
            imgUrl = match[1];
            // Убираем параметры размера для получения оригинала
            imgUrl = imgUrl.replace(/\/\d+x\d+\//, '/').replace(/\/\d+x\d+$/, '');
        }
    }

    // 2. Прямые img теги (превью)
    if (!imgUrl) {
        const imgTags = post.querySelectorAll('img');
        for (const imgTag of imgTags) {
            const src = imgTag.getAttribute('src') || imgTag.getAttribute('data-src') || '';
            if (src && src.includes('file/') && !src.includes('emoji')) {
                imgUrl = src;
                break;
            }
        }
    }

    // 3. Видео превью
    if (!imgUrl) {
        const videoThumb = post.querySelector('.tgme_widget_message_video_thumb');
        if (videoThumb) {
            const style = videoThumb.getAttribute('style') || '';
            const match = style.match(/url\(["']?([^"')\s]+)/);
            if (match) imgUrl = match[1];
        }
    }

    // 4. Ссылка-обёртка
    if (!imgUrl) {
        const linkEl = post.querySelector('.tgme_widget_message_wrap > a');
        if (linkEl) {
            const href = linkEl.getAttribute('href') || '';
            if (href.includes('/file/')) imgUrl = href;
        }
    }

    return imgUrl;
}

function proxyImageUrl(url) {
    if (!url) return '';
    if (url.includes('t.me') || url.includes('telegram.org') || url.includes('cdn') || url.startsWith('/')) {
        return `https://api.allorigins.win/raw?url=${encodeURIComponent(url.startsWith('http') ? url : 'https://t.me' + url)}`;
    }
    return url;
}

async function loadTelegramFeed() {
    const container = document.getElementById('telegram-feed');
    if (!container) return;

    container.innerHTML = `
        <div class="tg-loading">
            <div class="spinner"></div>
            Loading channels...
        </div>
    `;

    const allPosts = [];

    for (const channel of TG_CHANNELS) {
        try {
            const tgUrl = `https://t.me/s/${channel.url}`;
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(tgUrl)}`;

            const response = await fetchWithTimeout(proxyUrl);
            if (!response.ok) continue;

            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const posts = doc.querySelectorAll('.tgme_widget_message');
            if (posts.length === 0) continue;

            posts.forEach((post) => {
                const textEl = post.querySelector('.tgme_widget_message_text');
                const text = textEl ? textEl.innerHTML.substring(0, 500) : '';

                const dateEl = post.querySelector('.tgme_widget_message_date time');
                const dateStr = dateEl ? dateEl.getAttribute('datetime') || '' : '';
                const timestamp = dateStr ? new Date(dateStr).getTime() : 0;
                const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('ru-RU', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                }) : '';

                const postMsg = post.getAttribute('data-post') || '';

                allPosts.push({
                    channelName: channel.name,
                    text: text,
                    date: formattedDate,
                    timestamp: timestamp,
                    postLink: `https://t.me/${channel.url}/${postMsg}`
                });
            });

        } catch (err) {
            console.warn(`Failed to load channel ${channel.name}:`, err.message);
        }
    }

    // Сортируем по дате — новые СВЕРХУ
    allPosts.sort((a, b) => b.timestamp - a.timestamp);

    // Рендерим
    container.innerHTML = '';

    if (allPosts.length === 0) {
        container.innerHTML = `
            <div class="tg-loading">
                <div class="spinner"></div>
                Unable to load feeds
            </div>
        `;
        return;
    }

    allPosts.forEach((post, idx) => {
        const delay = idx * 0.06;
        const postHTML = `
            <div class="tg-post-card" style="animation-delay: ${delay}s" data-type="tg" onclick="window.open('${post.postLink}', '_blank')">
                <div class="tg-post-meta">
                    <span class="tg-post-source">
                        ✈ ${post.channelName.toUpperCase()}
                        <span class="tg-badge">TG</span>
                    </span>
                    <span class="tg-post-date">${post.date}</span>
                </div>
                <div class="tg-post-text">${post.text}</div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', postHTML);
    });
}

function startTelegramAutoRefresh() {
    if (tgFeedRefreshInterval) clearInterval(tgFeedRefreshInterval);
    // Обновляем каждые 60 секунд
    tgFeedRefreshInterval = setInterval(() => {
        loadTelegramFeed();
    }, 60000);
}

function stopTelegramAutoRefresh() {
    if (tgFeedRefreshInterval) {
        clearInterval(tgFeedRefreshInterval);
        tgFeedRefreshInterval = null;
    }
}

// === ФИЛЬТР НОВОСТЕЙ ===
window.filterNews = function(type, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const tgContainer = document.getElementById('telegram-feed');
    const siteContainer = document.getElementById('news-container');

    if (type === 'all') {
        tgContainer.classList.remove('hidden');
        siteContainer.classList.remove('hidden');
    } else if (type === 'tg') {
        tgContainer.classList.remove('hidden');
        siteContainer.classList.add('hidden');
    } else if (type === 'site') {
        tgContainer.classList.add('hidden');
        siteContainer.classList.remove('hidden');
    }
};

// === КАСТОМНЫЙ СТАТУС ===
window.saveCustomStatus = async () => {
    const input = document.getElementById('custom-status-input');
    if (!input || !auth.currentUser) return;
    const status = input.value.trim();
    await update(ref(db, 'users/' + auth.currentUser.uid), { customStatus: status || '' });
    document.getElementById('current-status-text').innerText = status || 'Not set';
    input.value = '';
};

function loadCustomStatus() {
    if (!auth.currentUser) return;
    onValue(ref(db, 'users/' + auth.currentUser.uid), (snap) => {
        const data = snap.val();
        const statusEl = document.getElementById('current-status-text');
        const inputEl = document.getElementById('custom-status-input');
        if (statusEl) statusEl.innerText = data?.customStatus || 'Not set';
        if (inputEl && data?.customStatus) inputEl.value = data.customStatus;
    });
}

// === СОЦИАЛЬНЫЕ СПИСКИ ===
let currentSocialTab = 'followers';

window.showSocialTab = function(tab) {
    currentSocialTab = tab;
    document.querySelectorAll('.social-tab').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    renderSocialList();
};

async function renderSocialList() {
    const list = document.getElementById('social-list');
    if (!list || !auth.currentUser) return;
    list.innerHTML = '<div class="social-empty">Loading...</div>';

    if (currentSocialTab === 'followers') {
        // Кто подписан на меня
        const snap = await get(ref(db, 'follows'));
        if (!snap.exists()) {
            list.innerHTML = '<div class="social-empty">No followers yet</div>';
            return;
        }
        const followers = [];
        snap.forEach(uSnap => {
            if (uSnap.hasChild(auth.currentUser.uid)) {
                followers.push(uSnap.key);
            }
        });

        if (followers.length === 0) {
            list.innerHTML = '<div class="social-empty">No followers yet</div>';
            return;
        }

        list.innerHTML = '';
        for (const uid of followers) {
            const userSnap = await get(ref(db, 'users/' + uid));
            const user = userSnap.val();
            if (!user) continue;
            list.innerHTML += `
                <div class="social-item" onclick="viewUserProfile('${uid}')">
                    <img src="${user.avatar || ''}" class="social-item-avatar" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=default'">
                    <div class="social-item-info">
                        <span class="social-item-name" style="color: ${roleStyles[user.role]?.color || '#888'}">${user.name}</span>
                        <span class="social-item-status">${user.customStatus || '---'}</span>
                    </div>
                    <span class="social-item-role" style="color: ${roleStyles[user.role]?.color || '#888'}">${user.role}</span>
                </div>
            `;
        }
    } else {
        // На кого я подписан
        const snap = await get(ref(db, `follows/${auth.currentUser.uid}`));
        if (!snap.exists()) {
            list.innerHTML = '<div class="social-empty">Not following anyone</div>';
            return;
        }
        const following = Object.keys(snap.val());

        if (following.length === 0) {
            list.innerHTML = '<div class="social-empty">Not following anyone</div>';
            return;
        }

        list.innerHTML = '';
        for (const uid of following) {
            const userSnap = await get(ref(db, 'users/' + uid));
            const user = userSnap.val();
            if (!user) continue;
            list.innerHTML += `
                <div class="social-item" onclick="viewUserProfile('${uid}')">
                    <img src="${user.avatar || ''}" class="social-item-avatar" onerror="this.src='https://api.dicebear.com/7.x/identicon/svg?seed=default'">
                    <div class="social-item-info">
                        <span class="social-item-name" style="color: ${roleStyles[user.role]?.color || '#888'}">${user.name}</span>
                        <span class="social-item-status">${user.customStatus || '---'}</span>
                    </div>
                    <span class="social-item-role" style="color: ${roleStyles[user.role]?.color || '#888'}">${user.role}</span>
                </div>
            `;
        }
    }
}

window.addEventListener('load', () => {
    initStars();
    initMouseEffects();
    loadTelegramFeed().then(() => startTelegramAutoRefresh());
    setTimeout(() => {
        const l = document.getElementById('initial-loader');
        if(l) {
            l.style.opacity = '0';
            setTimeout(() => l.style.display='none', 800);
        }
    }, 1000);
});

// Защита
document.addEventListener('contextmenu', event => event.preventDefault());
