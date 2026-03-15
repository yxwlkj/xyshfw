// 7.2-E: Chat UI refinement - sessions list, chat bubbles, emoji, history loading
let sessionsListEl = null;
(function(){
  const chatNameEl = document.getElementById('chatName');
  const chatStatusEl = document.getElementById('chatStatus');
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPanel = document.getElementById('emojiPanel');
  const uploadInput = document.getElementById('uploadInput');
  const attachBtn = document.getElementById('attachBtn');
  let sessions = [];
  let currentSession = null;
  let historyEndReached = false;

  const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😎','🤔','😢','😮','👍','🎉','❤️','🔥','✨','🤖','💡','🧠','🚀','🐛'];
  // Admin scaffold data (Patch 7.4)
  const ADMIN_STORAGE_KEY = 'adminTenants_v1';
  function getAdminAuthHeader() {
    const token = localStorage.getItem('admin_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  }
  function loginAdminIfNeeded() {
    const token = localStorage.getItem('admin_token');
    if (token) return Promise.resolve(token);
    const username = prompt('Admin username');
    const password = prompt('Admin password');
    if (!username || !password) return Promise.reject('no credentials');
    return fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(res => res.json()).then(r => {
      if (r?.data?.token) {
        localStorage.setItem('admin_token', r.data.token);
        return r.data.token;
      }
      throw new Error('admin login failed');
    });
  }
  let adminTenants = [];

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    setupUI();
    // Load admin tenants on startup (Patch 7.4)
    loadAdminTenants();
    // Mobile: toggle left conversation list visibility
    const mobileBackBtn = document.getElementById('mobileBackBtn');
    const leftPanel = document.getElementById('conversations');
    if (mobileBackBtn && leftPanel) {
      let leftVisible = true;
      // show button on small screens
      function maybeInit() {
        if (window.innerWidth <= 900) {
          mobileBackBtn.style.display = 'inline-block';
        } else {
          mobileBackBtn.style.display = 'none';
          leftPanel.style.display = 'block';
          leftVisible = true;
        }
      }
      window.addEventListener('resize', maybeInit);
      maybeInit();
      mobileBackBtn.addEventListener('click', () => {
        leftVisible = !leftVisible;
        leftPanel.style.display = leftVisible ? 'block' : 'none';
      });
    }
  });

  // Admin persistence helpers (Patch 7.4)
  function loadAdminTenants() {
    // Try server first
    fetch('/api/admin/tenants', { headers: getAdminAuthHeader() })
      .then(res => {
        if (res.status === 401) {
          // try login
          return loginAdminIfNeeded().then(() => fetch('/api/admin/tenants', { headers: getAdminAuthHeader() })).then(r => r.json());
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data?.tenants)) {
          adminTenants = data.tenants;
        }
        if (!adminTenants || adminTenants.length === 0) {
          adminTenants = [
            {id:'t1', name:'Campus Tech Co', status:'Active'},
            {id:'t2', name:'Library Services', status:'Active'}
          ];
        }
        persistAdminTenants();
        renderAdminScreen();
      })
      .catch(() => {
        const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
        if (raw) {
          try { adminTenants = JSON.parse(raw); } catch(e) { adminTenants = []; }
        }
        if (!adminTenants || adminTenants.length === 0) {
          adminTenants = [
            {id:'t1', name:'Campus Tech Co', status:'Active'},
            {id:'t2', name:'Library Services', status:'Active'}
          ];
        }
        renderAdminScreen();
      });
  }

  // Admin login UI handler (inline panel)
  function bindAdminLoginUI() {
    const btn = document.getElementById('adminLoginBtn');
    const u = document.getElementById('adminUser');
    const p = document.getElementById('adminPass');
    const status = document.getElementById('adminLoginStatus');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const username = (u && u.value) || '';
      const password = (p && p.value) || '';
      status.textContent = '';
      if (!username || !password) { status.textContent = '请输入用户名与密码'; return; }
      fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }).then(res => res.json())
        .then(r => {
          if (r?.data?.token) {
            localStorage.setItem('admin_token', r.data.token);
            status.textContent = '登录成功';
            // reload tenants using valid token
            loadAdminTenants();
          } else {
            status.textContent = '登录失败';
          }
        });
    });
  }

  function loadAllTenants() {
    fetch('/api/admin/tenants', { headers: getAdminHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.tenants)) {
          adminTenants = data.tenants;
          renderAdminScreenFromArray();
        }
      }).catch(() => { /* ignore */ });
  }

  function renderAdminScreenFromArray() {
    renderAdminScreen();
  }

  function persistAdminTenants() {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminTenants));
    } catch (e) {
      // ignore storage errors
    }
  }

  function setupUI() {
    // Send message
    const btn = document.getElementById('sendBtn');
    btn.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (!text || !currentSession) return;
      sendMessage(currentSession.id, text);
      inputEl.value = '';
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        btn.click();
      }
    });
    // Emoji
    emojiBtn.addEventListener('click', () => {
      emojiPanel.style.display = emojiPanel.style.display === 'none' ? 'grid' : 'none';
    });
    buildEmojiPanel();
    // Attach
    attachBtn.addEventListener('click', () => {
      uploadInput.click();
    });
    uploadInput.addEventListener('change', () => {
      // placeholder: uploading not implemented yet
      alert('Attachment upload is not implemented in this patch.');
    });
  }

  function loadSessions() {
    fetch('/api/chat/sessions')
      .then(res => res.json())
      .then(data => {
        sessions = data.sessions || [];
        renderSessions();
      })
      .catch(() => {
        // fallback demo data
        sessions = [
          {id:'s1', name:'Alice Chen', lastMessage:'Hey there 👋', unread:2, online:true, avatar:''},
          {id:'s2', name:'实验室群', lastMessage:'新公告：维护中', unread:0, online:false, avatar:''}
        ];
        renderSessions();
      });
  }

  function renderSessions() {
    sessionsListEl = document.getElementById('sessionsList');
    sessionsListEl.innerHTML = '';
    sessions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'session-item';
      item.dataset.sessionId = s.id;
      item.innerHTML = `
        <div class="session-thumb" style="background:#ddd"></div>
        <div class="session-meta">
          <div class="session-name">${escapeHtml(s.name||'Unknown')}</div>
          <div class="session-preview" title="${escapeHtml(s.lastMessage||'')}">${escapeHtml(s.lastMessage||'')}</div>
        </div>
        ${s.unread ? `<div class="session-unread">${s.unread}</div>` : ''}
      `;
      item.addEventListener('click', () => loadConversation(s.id, s.name, s.online));
      sessionsListEl.appendChild(item);
    });
  }

  function loadConversation(sessionId, name, online) {
    currentSession = {id: sessionId, name: name};
    chatNameEl.textContent = name || 'Chat';
    chatStatusEl.style.background = online ? '#34d399' : '#9ca3af';
    // reset messages and history state
    messagesEl.innerHTML = '';
    historyEndReached = false;
    loadHistory(sessionId);
  }

  function loadHistory(sessionId) {
    fetch(`/api/messages/history?sessionId=${encodeURIComponent(sessionId)}&limit=20`)
      .then(res => res.json())
      .then(data => {
        const msgs = data.messages || [];
        if (msgs.length === 0) historyEndReached = true;
        // render in reverse chronological order
        msgs.reverse().forEach(m => renderMessage(m, false));
        // auto-scroll to bottom
        const messagesEl = document.getElementById('messages');
        messagesEl.scrollTop = messagesEl.scrollHeight;
      })
      .catch(() => {
        // demo history
        const demo = [
          {id:'m1', from:'them', content:'欢迎来到聊天演示', timestamp:'2026-03-15 10:00', type:'text'},
        ];
        demo.forEach(m => renderMessage(m, false));
        const messagesEl = document.getElementById('messages');
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
  }

  function renderMessage(m, fromMe) {
    const messagesEl = document.getElementById('messages');
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (fromMe ? 'me' : 'you');
    if (m.type === 'image') {
      const img = document.createElement('img');
      img.src = m.content; img.style.maxWidth = '100%'; img.style.borderRadius='8px';
      bubble.appendChild(img);
    } else {
      bubble.textContent = m.content;
    }
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = m.timestamp || '';
    bubble.appendChild(document.createElement('br'));
    bubble.appendChild(time);
    messagesEl.appendChild(bubble);
  }

  function sendMessage(sessionId, text) {
    const payload = { sessionId, content: text };
    fetch('/api/messages/send', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).then(res => res.json())
      .then(r => {
        // append bubble
        renderMessage({content: text, timestamp: new Date().toLocaleTimeString(), type:'text'}, true);
        const messagesEl = document.getElementById('messages');
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }).catch(() => {
        // fallback: appear locally
        renderMessage({content: text, timestamp: new Date().toLocaleTimeString(), type:'text'}, true);
        const messagesEl = document.getElementById('messages');
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
  }

  function buildEmojiPanel() {
    const emojiPanel = document.getElementById('emojiPanel');
    emojiPanel.innerHTML = '';
    EMOJIS.forEach(e => {
      const b = document.createElement('button');
      b.textContent = e;
      b.addEventListener('click', () => insertAtCursor(document.getElementById('messageInput'), e));
      emojiPanel.appendChild(b);
    });
  }

  function insertAtCursor(el, text) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    el.value = value.substring(0, start) + text + value.substring(end);
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
    el.focus();
  }

function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Admin rendering (Patch 7.4)
function renderAdminScreen() {
    const body = document.getElementById('adminTenantBody');
    if (!body) return;
    body.innerHTML = '';
    adminTenants.forEach(t => {
      // Build an editable row
      const tr = document.createElement('tr');
      tr.setAttribute('data-id', t.id);
      const isActive = t.status === 'Active';
      tr.innerHTML = `
        <td style="padding:6px 8px;"><input class="tenant-name" value="${escapeHtml(t.name)}" style="width:100%;"/></td>
        <td style="padding:6px 8px;"><input class="tenant-desc" value="${escapeHtml(t.description || '')}" style="width:100%;"/></td>
        <td style="padding:6px 8px;">
          <select class="tenant-status" style="width:100%;">
            <option value="Active" ${isActive ? 'selected' : ''}>Active</option>
            <option value="Inactive" ${isActive ? '' : 'selected'}>Inactive</option>
          </select>
        </td>
        <td style="padding:6px 8px;">
          <button class="tenant-save" data-id="${t.id}">Save</button>
          <button class="tenant-delete" data-id="${t.id}">Delete</button>
        </td>
      `;
      body.appendChild(tr);
    });
    // Save/Delete handlers
  body.querySelectorAll('.tenant-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const row = body.querySelector(`tr[data-id='${id}']`);
        const nameInput = row.querySelector('.tenant-name');
        const statusSel = row.querySelector('.tenant-status');
        const descInput = row.querySelector('.tenant-desc');
        const newName = nameInput.value.trim();
        const newStatus = statusSel.value;
        const newDesc = (descInput && descInput.value) ? descInput.value : '';
        if (!newName) return;
        // PUT to server
        fetch(`/api/admin/tenants/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName, status: newStatus, description: newDesc })
        }).then(res => res.json())
          .then(r => {
            if (r.code === 200) {
              // refresh local data
              loadAdminTenants();
            }
          });
      });
    });
    body.querySelectorAll('.tenant-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        fetch(`/api/admin/tenants/${id}`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json())
          .then(r => { if (r.code === 200) loadAdminTenants(); });
      });
    });

    // Bind new tenant form (footer)
    const newName = document.getElementById('newTenantName');
    const newDesc = document.getElementById('newTenantDesc');
    const newStatus = document.getElementById('newTenantStatus');
    const newCreateBtn = document.getElementById('newTenantCreateBtn');
    if (newCreateBtn && newName && newStatus) {
      newCreateBtn.onclick = async () => {
        const nameVal = newName.value.trim();
        if (!nameVal) return;
        // POST to server
        try {
          const res = await fetch('/api/admin/tenants', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nameVal, status: newStatus.value })
          });
          const data = await res.json();
          if (data.code === 200 || data.data) {
            newName.value = '';
            loadAdminTenants();
          }
        } catch (e) {
          // fallback local add including description
          const descVal = (newDesc && newDesc.value) ? newDesc.value : '';
          adminTenants.push({ id: 't' + (adminTenants.length + 1), name: nameVal, status: newStatus.value, description: descVal });
          renderAdminScreen();
          persistAdminTenants();
        }
      };
    }
  }

  // Screen switching (Patch 7.3)
  function switchScreen(view) {
    const appView = document.getElementById('appView');
    const screenContacts = document.getElementById('screen-contacts');
    const screenDiscover = document.getElementById('screen-discover');
    const screenMe = document.getElementById('screen-me');
    // Hide all
    if (appView) appView.style.display = 'none';
    if (screenContacts) screenContacts.style.display = 'none';
    if (screenDiscover) screenDiscover.style.display = 'none';
    if (screenMe) screenMe.style.display = 'none';
    // Show target
    if (view === 'sessions') {
      if (appView) appView.style.display = 'grid';
    } else if (view === 'contacts') {
      screenContacts.style.display = 'block';
    } else if (view === 'discover') {
      screenDiscover.style.display = 'block';
    } else if (view === 'me') {
      screenMe.style.display = 'block';
    } else if (view === 'admin') {
      // render admin dashboard
      renderAdminScreen();
      screenContacts.style.display = 'none';
      screenDiscover.style.display = 'none';
      screenMe.style.display = 'none';
      if (appView) appView.style.display = 'none';
      const screenAdmin = document.getElementById('screen-admin');
      if (screenAdmin) screenAdmin.style.display = 'block';
    }
    // Update active state on bottom nav
    document.querySelectorAll('#bottomNav .nav-item').forEach(n => n.classList.remove('active'));
    const btn = document.querySelector(`#bottomNav .nav-item[data-view='${view}']`);
    if (btn) btn.classList.add('active');
  }

  document.addEventListener('DOMContentLoaded', () => {
    // existing init
    // Attach bottom nav handlers for patch 7.3
    const navItems = document.querySelectorAll('#bottomNav .nav-item');
    navItems.forEach(it => {
      it.addEventListener('click', () => {
        const v = it.getAttribute('data-view');
        switchScreen(v);
      });
    });
    // Admin create button
    const adminCreateBtn = document.getElementById('adminCreateBtn');
    if (adminCreateBtn) {
      adminCreateBtn.addEventListener('click', () => {
        const name = prompt('Tenant name');
        if (name && name.trim()) {
          adminTenants.push({id: 't' + (adminTenants.length+1), name: name.trim(), status: 'Active'});
          renderAdminScreen();
          persistAdminTenants();
        }
      });
    }
    // Bind Admin Login UI
    bindAdminLoginUI();
    // Bind additional admin actions
    const searchByIdBtn = document.getElementById('adminTenantSearchIdBtn');
    if (searchByIdBtn) {
      searchByIdBtn.addEventListener('click', async () => {
        const id = document.getElementById('adminTenantSearchId')?.value;
        if (!id) return;
        try {
          const res = await fetch(`/api/admin/tenants/${id}`, { headers: getAdminHeaders() });
          const data = await res.json();
          if (data.tenant) {
            renderAdminTenantRows([data.tenant]);
          }
        } catch (e) {
          // ignore
        }
      });
    }
  });

// Admin helpers for enhanced UX (Patch 7.5+)
function getAdminHeaders() {
  const token = localStorage.getItem('admin_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function renderAdminTenantRows(rows) {
  const body = document.getElementById('adminTenantBody');
  if (!body) return;
  body.innerHTML = '';
  rows.forEach(t => {
    const tr = document.createElement('tr');
    tr.dataset.id = t.id;
    const name = t.name || '';
    const desc = t.description || '';
    const status = t.status || 'Active';
    const isActive = status === 'Active';
    tr.innerHTML = `
      <td style="padding:6px 8px;"><input class="tenant-name" value="${escapeHtml(name)}" style="width:100%;"/></td>
      <td style="padding:6px 8px;"><input class="tenant-desc" value="${escapeHtml(desc)}" style="width:100%;"/></td>
      <td style="padding:6px 8px;"><select class="tenant-status" style="width:100%;">${isActive ? '<option value="Active" selected>Active</option><option value="Inactive">Inactive</option>' : '<option value="Active">Active</option><option value="Inactive" selected>Inactive</option>'}</select></td>
      <td style="padding:6px 8px;"><button class="tenant-save" data-id="${t.id}">Save</button><button class="tenant-delete" data-id="${t.id}">Delete</button></td>
    `;
    body.appendChild(tr);
  });
  // Bind actions (Save/Delete) similar to renderAdminScreen
  const saves = body.querySelectorAll('.tenant-save');
  saves.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const row = body.querySelector(`tr[data-id='${id}']`);
      const nameInput = row.querySelector('.tenant-name');
      const descInput = row.querySelector('.tenant-desc');
      const statusSel = row.querySelector('.tenant-status');
      const newName = nameInput.value.trim();
      const newDesc = descInput.value;
      const newStatus = statusSel.value;
      if (!newName) return;
      fetch(`/api/admin/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc, status: newStatus })
      }).then(res => res.json()).then(r => {
        if (r.code === 200) loadAdminTenants();
      }).catch(() => {
        // local fallback
        loadAdminTenants();
      });
    });
  });
  const deletes = body.querySelectorAll('.tenant-delete');
  deletes.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      fetch(`/api/admin/tenants/${id}`, { method: 'DELETE' , headers: getAdminHeaders() }).then(res => res.json()).then(r => {
        if (r.code === 200) loadAdminTenants();
      }).catch(() => {
        loadAdminTenants();
      });
    });
  });
}

function bindAdminSearchUI() {
  const searchBtn = document.getElementById('adminTenantSearchBtn');
  const searchInput = document.getElementById('adminTenantSearch');
  if (!searchBtn || !searchInput) return;
  searchBtn.addEventListener('click', async () => {
    const q = searchInput.value.trim();
    if (!q) return;
    try {
      const res = await fetch(`/api/admin/tenants/search?q=${encodeURIComponent(q)}`, { headers: getAdminHeaders() });
      const data = await res.json();
      if (Array.isArray(data.tenants)) renderAdminTenantRows(data.tenants);
    } catch (e) {
      // ignore
    }
  });
}

function bindAdminRefreshUI() {
  const refreshBtn = document.getElementById('adminTenantRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadAdminTenants());
  }
}

(function initAdminUIEnhancements(){
  // Attempt to wire the UI enhancements after DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    bindAdminSearchUI();
    bindAdminRefreshUI();
    // Bind initial render of admin tenants if not yet rendered via loadAdminTenants
    // We rely on existing loadAdminTenants flow
  });
})();
