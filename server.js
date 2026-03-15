const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const initSqlJs = require('sql.js');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
 app.use('/uploads', express.static('uploads'));
 // Serve a minimal front-end for quick testing
 app.use('/', express.static(path.join(__dirname, 'web_app')));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, pingTimeout: 60000 });

const JWT_SECRET = 'campus-wechat-2026';
const DB_PATH = path.join(__dirname, 'campus.db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, UPLOAD_DIR), filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) });
const upload = multer({ storage });

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  
  const tables = [
    `users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, nickname TEXT, avatar TEXT DEFAULT '', phone TEXT, status INTEGER DEFAULT 1, online INTEGER DEFAULT 0, money REAL DEFAULT 0, role TEXT DEFAULT 'user', settings TEXT DEFAULT '{}', last_online DATETIME, create_time DATETIME)`,
    `friends (id INTEGER PRIMARY KEY, uid INTEGER, friend_uid INTEGER, status INTEGER DEFAULT 0, create_time DATETIME, UNIQUE(uid, friend_uid))`,
    `friend_requests (id INTEGER PRIMARY KEY, from_uid INTEGER, to_uid INTEGER, status INTEGER DEFAULT 0, message TEXT, create_time DATETIME)`,
    `blocked_users (id INTEGER PRIMARY KEY, uid INTEGER, block_uid INTEGER, create_time DATETIME, UNIQUE(uid, block_uid))`,
    `messages (id INTEGER PRIMARY KEY, from_uid INTEGER, to_uid INTEGER DEFAULT 0, group_id TEXT DEFAULT '', content TEXT, type TEXT DEFAULT 'text', file_url TEXT DEFAULT '', is_read INTEGER DEFAULT 0, is_del INTEGER DEFAULT 0, create_time DATETIME)`,
    `groups (id TEXT PRIMARY KEY, name TEXT, avatar TEXT DEFAULT '', owner_uid INTEGER, is_dissolved INTEGER DEFAULT 0, create_time DATETIME)`,
    `group_members (id INTEGER PRIMARY KEY, group_id TEXT, uid INTEGER, role TEXT DEFAULT 'member', nickname TEXT, create_time DATETIME, UNIQUE(group_id, uid))`,
    `moments (id INTEGER PRIMARY KEY, uid INTEGER, content TEXT, images TEXT DEFAULT '[]', like_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0, create_time DATETIME)`,
    `moment_likes (id INTEGER PRIMARY KEY, uid INTEGER, moment_id INTEGER, create_time DATETIME, UNIQUE(uid, moment_id))`,
    `moment_comments (id INTEGER PRIMARY KEY, uid INTEGER, moment_id INTEGER, content TEXT, create_time DATETIME)`,
    `follows (id INTEGER PRIMARY KEY, uid INTEGER, follow_uid INTEGER, create_time DATETIME, UNIQUE(uid, follow_uid))`,
    `run_orders (id INTEGER PRIMARY KEY, uid INTEGER, runner_uid INTEGER DEFAULT 0, type TEXT DEFAULT 'run', title TEXT, detail TEXT, fee REAL, from_addr TEXT, to_addr TEXT, status INTEGER DEFAULT 0, create_time DATETIME)`,
    `rider_auth (id INTEGER PRIMARY KEY, uid INTEGER, name TEXT, id_card TEXT, phone TEXT, status INTEGER DEFAULT 0, create_time DATETIME)`,
    `shops (id INTEGER PRIMARY KEY, uid INTEGER, name TEXT, logo TEXT, phone TEXT, address TEXT, status INTEGER DEFAULT 0, create_time DATETIME)`,
    `reviews (id INTEGER PRIMARY KEY, order_id INTEGER, from_uid INTEGER, to_uid INTEGER, rating INTEGER, content TEXT, create_time DATETIME)`,
    `addresses (id INTEGER PRIMARY KEY, uid INTEGER, name TEXT, phone TEXT, address TEXT, is_default INTEGER DEFAULT 0, create_time DATETIME)`,
    `admins (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'admin', create_time DATETIME)`,
    `logs (id INTEGER PRIMARY KEY, admin_id INTEGER, action TEXT, detail TEXT, create_time DATETIME)`,
    `notices (id INTEGER PRIMARY KEY, title TEXT, content TEXT, status INTEGER DEFAULT 1, create_time DATETIME)`,
    `banners (id INTEGER PRIMARY KEY, title TEXT, image TEXT, url TEXT, sort INTEGER DEFAULT 0, create_time DATETIME)`
  ];
  
  for (const t of tables) db.run(`CREATE TABLE IF NOT EXISTS ${t}`);
  // Admin tenants storage (Patch 7.5): ensure table exists and seed sample data once
  db.run(`CREATE TABLE IF NOT EXISTS admin_tenants (id TEXT PRIMARY KEY, name TEXT, status TEXT, create_time DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  try {
    const seedCount = query('SELECT COUNT(*) as cnt FROM admin_tenants')[0]?.cnt || 0;
    if (seedCount === 0) {
      const t1 = uuidv4();
      const t2 = uuidv4();
      run('INSERT INTO admin_tenants (id, name, status) VALUES (?,?,?)', [t1, 'Campus Tech Co', 'Active']);
      run('INSERT INTO admin_tenants (id, name, status) VALUES (?,?,?)', [t2, 'Library Services', 'Active']);
    }
  } catch (e) {
    // If something goes wrong, we ignore and let memory fallback handle
  }
  // Simple migrations scaffold (Patch 7.5)
  // Create migrations table if not exists and seed initial version
  db.run(`CREATE TABLE IF NOT EXISTS admin_migrations (version INTEGER PRIMARY KEY, description TEXT, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  try {
    const maxVer = query('SELECT MAX(version) as v FROM admin_migrations')[0]?.v || 0;
    if (maxVer < 1) {
      db.run(`INSERT INTO admin_migrations (version, description) VALUES (1, 'Init admin tenants migration')`);
    }
    // Migration 2: add description column to admin_tenants
    if (maxVer < 2) {
      db.run("ALTER TABLE admin_tenants ADD COLUMN description TEXT DEFAULT ''");
      db.run(`INSERT INTO admin_migrations (version, description) VALUES (2, 'Add description column to admin_tenants')`);
      console.log('Migration 2 applied: admin_tenants.description added');
    }
    // Migration 3: add index on admin_tenants.name for faster lookups
    try {
      db.run("CREATE INDEX IF NOT EXISTS idx_admin_tenants_name ON admin_tenants (name)");
      db.run(`INSERT INTO admin_migrations (version, description) VALUES (3, 'Add index on admin_tenants.name')`);
      console.log('Migration 3 applied: idx_admin_tenants_name created');
    } catch (e) {
      console.error('Migration 3 (index) error', e);
    }
  } catch (e) {
    console.error('Migration error', e);
  }
  // Ensure chat-related tables exist (Phase 1)
  // Auto admin migrations runner (idempotent) - Patch 7.5
  try {
    const curr = query('SELECT MAX(version) as v FROM admin_migrations')[0]?.v || 0;
    if (curr < 3) {
      db.run('CREATE INDEX IF NOT EXISTS idx_admin_tenants_name ON admin_tenants (name)');
      db.run(`INSERT INTO admin_migrations (version, description) VALUES (3, 'Add index on admin_tenants.name')`);
      console.log('Migration 3 auto-applied on startup');
    }
  } catch (e) {
    console.error('Auto migration check failed', e);
  }
  try {
    await ensureChatTables();
  } catch (e) {
    console.error('初始化聊天表错误', e);
  }
  saveDB();
  console.log('✅ 数据库初始化完成');
}

// Ensure core chat tables exist (阶段 1 for core chat features)
async function ensureChatTables() {
  // 使用 db.run 以兼容 sql.js 的接口
  db.run(`CREATE TABLE IF NOT EXISTS friend_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    from_uid INT NOT NULL,
    to_uid INT NOT NULL,
    status INT DEFAULT 0,
    message VARCHAR(512),
    create_time DATETIME DEFAULT NOW()
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS friends (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uid INT NOT NULL,
    friend_uid INT NOT NULL,
    status INT DEFAULT 1,
    create_time DATETIME DEFAULT NOW(),
    UNIQUE KEY (uid, friend_uid)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS blocked_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uid INT NOT NULL,
    block_uid INT NOT NULL,
    create_time DATETIME DEFAULT NOW(),
    UNIQUE KEY (uid, block_uid)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner_uid INT NOT NULL,
    avatar VARCHAR(255) DEFAULT '',
    is_dissolved BOOLEAN DEFAULT FALSE,
    create_time DATETIME DEFAULT NOW()
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS group_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    group_id VARCHAR(50) NOT NULL,
    uid INT NOT NULL,
    role VARCHAR(20) DEFAULT 'member',
    nickname VARCHAR(100),
    create_time DATETIME DEFAULT NOW(),
    UNIQUE KEY (group_id, uid)
  );`);
  console.log('✅ 聊天核心表初始化完成');
}

function saveDB() { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function run(sql, params = []) { db.run(sql, params); saveDB(); return { lastID: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] || 0 }; }

const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ code: 401, msg: '请先登录' });
    req.uid = jwt.verify(token, JWT_SECRET).uid;
    next();
  } catch (err) { res.status(401).json({ code: 401, msg: 'token失效' }); }
};

const adminAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ code: 401, msg: '请先登录' });
    const admins = query('SELECT * FROM admins WHERE id=?', [jwt.verify(token, JWT_SECRET).uid]);
    if (admins.length === 0) return res.status(403).json({ code: 403, msg: '权限不足' });
    req.admin = admins[0];
    next();
  } catch (err) { res.status(401).json({ code: 401, msg: 'token失效' }); }
};

// Health endpoints
app.get('/api/healthz', (req, res) => { res.json({ ok: true }); });
app.get('/api/admin/health', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  const tenantsCount = (query('SELECT COUNT(*) as cnt FROM admin_tenants')[0]?.cnt) || 0;
  res.json({ ok: true, tenants: tenantsCount, users: query('SELECT COUNT(*) as cnt FROM users')[0]?.cnt || 0 });
});

// Role-based access control for Admin routes
function requireAdminRole(roles) {
  // roles: array of allowed role strings
  return (req, res, next) => {
    const role = req.admin?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).json({ code: 403, msg: '权限不足' });
    }
    next();
  };
}

// ====================== Socket ======================
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('login', (uid) => { onlineUsers.set(uid, socket.id); socket.uid = uid; run('UPDATE users SET online=1 WHERE id=?', [uid]); io.emit('user_online', { uid, online: true }); });
  // Offline message sync hook
  socket.on('sync_offline', () => {
    try {
      const rows = [];
      const stmt = db.prepare('SELECT id, from_uid, to_uid, group_id, content, type, file_url, create_time FROM messages WHERE to_uid=? AND is_read=0');
      stmt.bind([socket.uid]);
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      if (rows.length > 0) {
        io.to(socket.id).emit('offline_messages', rows);
        db.run('UPDATE messages SET is_read=1 WHERE to_uid=? AND is_read=0', [socket.uid]);
      }
    } catch (e) {
      console.error('sync_offline error', e);
    }
  });
  // 新增实时通信事件
  socket.on('typing', (data) => {
    const toSocketId = onlineUsers.get(data.toUid);
    if (toSocketId) io.to(toSocketId).emit('typing', { fromUid: socket.uid, chatType: data.chatType, targetId: data.targetId, isTyping: data.isTyping });
  });
  // 离线消息同步：发送未读信息给上线用户
  socket.on('sync_offline', () => {
    try {
      const stmt = db.prepare('SELECT id, from_uid, to_uid, content, type, file_url, create_time FROM messages WHERE to_uid=? AND is_read=0', [socket.uid]);
      const offline = [];
      while (stmt.step()) offline.push(stmt.getAsObject());
      stmt.free();
      if (offline.length > 0) {
        io.to(socket.id).emit('offline_messages', offline);
        db.run('UPDATE messages SET is_read=1 WHERE to_uid=? AND is_read=0', [socket.uid]);
      }
    } catch (e) {
      console.error('sync_offline error', e);
    }
  });
  socket.on('call_offer', (data) => {
    const toSocketId = onlineUsers.get(data.toUid);
    if (toSocketId) io.to(toSocketId).emit('call_offer', { fromUid: socket.uid, offer: data.offer, roomId: data.roomId });
  });
  socket.on('call_answer', (data) => {
    const toSocketId = onlineUsers.get(data.toUid);
    if (toSocketId) io.to(toSocketId).emit('call_answer', { answer: data.answer, roomId: data.roomId });
  });
  socket.on('ice_candidate', (data) => {
    const toSocketId = onlineUsers.get(data.toUid);
    if (toSocketId) io.to(toSocketId).emit('ice_candidate', { candidate: data.candidate, roomId: data.roomId });
  });
  socket.on('hang_up', (data) => {
    const toSocketId = onlineUsers.get(data.toUid);
    if (toSocketId) io.to(toSocketId).emit('call_hanged_up', { roomId: data.roomId });
  });
  
  socket.on('send_msg', async (data) => {
    const { toUid, content, type = 'text', fileUrl = '' } = data;
    const msgId = run('INSERT INTO messages (from_uid, to_uid, content, type, file_url, is_read) VALUES (?,?,?,?,?,0)', [socket.uid, toUid, content, type, fileUrl]).lastID;
    const toSocketId = onlineUsers.get(toUid);
    if (toSocketId) io.to(toSocketId).emit('recv_msg', { id: msgId, fromUid: socket.uid, content, type, fileUrl, time: new Date().toISOString() });
  });
  
  socket.on('send_group_msg', async (data) => {
    const { groupId, content, type = 'text', fileUrl = '' } = data;
    const msgId = run('INSERT INTO messages (from_uid, group_id, content, type, file_url) VALUES (?,?,?,?,?)', [socket.uid, groupId, content, type, fileUrl]).lastID;
    query('SELECT uid FROM group_members WHERE group_id=?', [groupId]).forEach(m => { if (onlineUsers.get(m.uid)) io.to(onlineUsers.get(m.uid)).emit('recv_group_msg', { id: msgId, groupId, fromUid: socket.uid, content, type, fileUrl }); });
  });
  
  socket.on('create_group', async (data) => {
    const { name, memberIds } = data;
    const groupId = uuidv4();
    run('INSERT INTO groups (id, name, owner_uid) VALUES (?,?,?)', [groupId, name, socket.uid]);
    run('INSERT INTO group_members (group_id, uid, role) VALUES (?,?,?)', [groupId, socket.uid, 'owner']);
    memberIds.forEach(uid => run('INSERT OR IGNORE INTO group_members (group_id, uid, role) VALUES (?,?,?)', [groupId, uid, 'member']));
    socket.emit('group_created', { groupId, name });
  });
  
  socket.on('call', (data) => { const toSocketId = onlineUsers.get(data.toUid); if (toSocketId) io.to(toSocketId).emit('incoming_call', { fromUid: socket.uid, callType: data.callType, roomId: data.roomId }); });
  socket.on('call_accept', (data) => { const toSocketId = onlineUsers.get(data.toUid); if (toSocketId) io.to(toSocketId).emit('call_accepted', { roomId: data.roomId }); });
  socket.on('call_reject', (data) => { const toSocketId = onlineUsers.get(data.toUid); if (toSocketId) io.to(toSocketId).emit('call_rejected'); });
  
  socket.on('disconnect', () => { if (socket.uid) { onlineUsers.delete(socket.uid); run('UPDATE users SET online=0 WHERE id=?', [socket.uid]); io.emit('user_offline', { uid: socket.uid }); } });
});

// ====================== 用户 ======================
app.post('/api/user/register', async (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password || !nickname) return res.json({ code: 400, msg: '信息不完整' });
  if (query('SELECT id FROM users WHERE username=?', [username]).length > 0) return res.json({ code: 400, msg: '用户名已存在' });
  const result = run('INSERT INTO users (username, password, nickname) VALUES (?,?,?)', [username, bcrypt.hashSync(password, 10), nickname]);
  res.json({ code: 200, msg: '注册成功', data: { uid: result.lastID } });
});

app.post('/api/user/login', async (req, res) => {
  const { username, password } = req.body;
  const users = query('SELECT * FROM users WHERE username=?', [username]);
  if (users.length === 0) return res.json({ code: 400, msg: '用户不存在' });
  if (!bcrypt.compareSync(password, users[0].password)) return res.json({ code: 400, msg: '密码错误' });
  if (users[0].status === 0) return res.json({ code: 400, msg: '账号已被冻结' });
  const token = jwt.sign({ uid: users[0].id }, JWT_SECRET, { expiresIn: '7d' });
  delete users[0].password;
  res.json({ code: 200, msg: '登录成功', data: { token, user: users[0] } });
});

// Admin login for adminAuth-protected endpoints (Patch 7.5)
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ code: 400, msg: '信息不完整' });
  const admins = query('SELECT id, password FROM admins WHERE username=?', [username]);
  if (admins.length === 0) return res.json({ code: 400, msg: '管理员不存在' });
  if (!bcrypt.compareSync(password, admins[0].password)) return res.json({ code: 400, msg: '密码错误' });
  const token = jwt.sign({ uid: admins[0].id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ code: 200, msg: '登录成功', data: { token } });
});

app.get('/api/user/info', auth, (req, res) => { const users = query('SELECT * FROM users WHERE id=?', [req.uid]); res.json({ code: 200, data: users[0] }); });
app.post('/api/user/update', auth, (req, res) => { const { nickname, avatar, phone, settings } = req.body; run('UPDATE users SET nickname=?, avatar=?, phone=?, settings=? WHERE id=?', [nickname || '', avatar || '', phone || '', JSON.stringify(settings || {}), req.uid]); res.json({ code: 200, msg: '更新成功' }); });
app.post('/api/user/set_status', auth, (req, res) => { const { online } = req.body; run('UPDATE users SET online=? WHERE id=?', [online, req.uid]); io.emit('status_changed', { uid: req.uid, online }); res.json({ code: 200, msg: '状态已更新' }); });
app.get('/api/user/search', auth, (req, res) => { const { keyword } = req.query; res.json({ code: 200, data: query('SELECT id, nickname, avatar, online FROM users WHERE nickname LIKE ? AND id!=? LIMIT 20', [`%${keyword || ''}%`, req.uid]) }); });

// ====================== 好友 ======================
app.get('/api/friends', auth, (req, res) => { res.json({ code: 200, data: query('SELECT u.id, u.nickname, u.avatar, u.online, u.last_online FROM friends f LEFT JOIN users u ON f.friend_uid=u.id WHERE f.uid=? AND f.status=1', [req.uid]) }); });
app.get('/api/friend_requests', auth, (req, res) => { res.json({ code: 200, data: query('SELECT r.*, u.nickname, u.avatar FROM friend_requests r LEFT JOIN users u ON r.from_uid=u.id WHERE r.to_uid=? AND r.status=0', [req.uid]) }); });
app.post('/api/friend/add', auth, (req, res) => { const { toUid, message = '' } = req.body; if (toUid == req.uid) return res.json({ code: 400, msg: '不能添加自己' }); run('INSERT INTO friend_requests (from_uid, to_uid, message) VALUES (?,?,?)', [req.uid, toUid, message]); const toSocketId = onlineUsers.get(toUid); if (toSocketId) io.to(toSocketId).emit('new_friend_request', { fromUid: req.uid }); res.json({ code: 200, msg: '申请已发送' }); });
app.post('/api/friend/accept', auth, (req, res) => { const { requestId } = req.body; const requests = query('SELECT * FROM friend_requests WHERE id=? AND to_uid=?', [requestId, req.uid]); if (requests.length === 0) return res.json({ code: 400, msg: '请求不存在' }); run('UPDATE friend_requests SET status=1 WHERE id=?', [requestId]); run('INSERT OR IGNORE INTO friends (uid, friend_uid, status) VALUES (?,?,1)', [req.uid, requests[0].from_uid]); run('INSERT OR IGNORE INTO friends (uid, friend_uid, status) VALUES (?,?,1)', [requests[0].from_uid, req.uid]); res.json({ code: 200, msg: '已同意' }); });
app.post('/api/friend/reject', auth, (req, res) => { run('UPDATE friend_requests SET status=2 WHERE id=?', [req.body.requestId]); res.json({ code: 200, msg: '已拒绝' }); });
app.post('/api/friend/delete', auth, (req, res) => { run('DELETE FROM friends WHERE uid=? AND friend_uid=?', [req.uid, req.body.friendUid]); run('DELETE FROM friends WHERE uid=? AND friend_uid=?', [req.body.friendUid, req.uid]); res.json({ code: 200, msg: '已删除' }); });
app.post('/api/friend/block', auth, (req, res) => { run('INSERT OR IGNORE INTO blocked_users (uid, block_uid) VALUES (?,?)', [req.uid, req.body.friendUid]); run('DELETE FROM friends WHERE uid=? AND friend_uid=?', [req.uid, req.body.friendUid]); res.json({ code: 200, msg: '已拉黑' }); });
app.get('/api/blocked', auth, (req, res) => { res.json({ code: 200, data: query('SELECT u.id, u.nickname, u.avatar FROM blocked_users b LEFT JOIN users u ON b.block_uid=u.id WHERE b.uid=?', [req.uid]) }); });

// ====================== 消息 ======================
app.get('/api/chat/sessions', auth, (req, res) => {
  const sessions = query(`SELECT DISTINCT CASE WHEN from_uid=? THEN to_uid ELSE from_uid END as target_id FROM messages WHERE from_uid=? OR to_uid=? GROUP BY target_id ORDER BY (SELECT create_time FROM messages WHERE (from_uid=? AND to_uid=target_id) OR (from_uid=target_id AND to_uid=?) ORDER BY create_time DESC LIMIT 1) DESC LIMIT 30`, [req.uid, req.uid, req.uid, req.uid, req.uid]);
  res.json({ code: 200, data: sessions.map(s => ({ target: query('SELECT id, nickname, avatar, online FROM users WHERE id=?', [s.target_id])[0] || {} })) });
});

app.get('/api/chat/history', auth, (req, res) => { const { targetId, chatType = 'p2p' } = req.query; const messages = chatType === 'p2p' ? query('SELECT * FROM messages WHERE ((from_uid=? AND to_uid=?) OR (from_uid=? AND to_uid=?)) AND is_del=0 ORDER BY create_time ASC LIMIT 100', [req.uid, targetId, targetId, req.uid]) : query('SELECT * FROM messages WHERE group_id=? AND is_del=0 ORDER BY create_time ASC LIMIT 100', [targetId]); res.json({ code: 200, data: messages }); });
app.post('/api/chat/mark_read', auth, (req, res) => {
  const { chatType, targetId } = req.body;
  if (chatType === 'private') {
    // 标记单聊未读为已读
    run('UPDATE messages SET is_read=1 WHERE from_uid=? AND to_uid=? AND is_read=0', [targetId, req.uid]);
    // 发送回执给对方（如果在线）
    const toSocket = onlineUsers.get(targetId);
    if (toSocket) io.to(toSocket).emit('read_receipt', { fromUid: req.uid, toUid: targetId, chatType: 'private' });
  } else {
    // 群聊：标记群组消息为已读，并通知群成员在线用户
    run('UPDATE messages SET is_read=1 WHERE group_id=? AND is_read=0', [targetId]);
    const members = query('SELECT uid FROM group_members WHERE group_id=?', [targetId]);
    members.forEach(m => {
      const sid = onlineUsers.get(m.uid);
      if (sid) io.to(sid).emit('read_receipt', { fromUid: req.uid, groupId: targetId, chatType: 'group' });
    });
  }
  res.json({ code: 200, msg: '已标记' });
});
app.get('/api/chat/unread', auth, (req, res) => { res.json({ code: 200, data: { count: query('SELECT COUNT(*) as cnt FROM messages WHERE to_uid=? AND is_read=0', [req.uid])[0]?.cnt || 0 } }); });

// ====================== 群聊 ======================
app.get('/api/groups', auth, (req, res) => { res.json({ code: 200, data: query('SELECT g.* FROM groups g LEFT JOIN group_members gm ON g.id=gm.group_id WHERE gm.uid=? AND g.is_dissolved=0', [req.uid]) }); });
app.get('/api/group/members', auth, (req, res) => { res.json({ code: 200, data: query('SELECT u.id, u.nickname, u.avatar, gm.role FROM group_members gm LEFT JOIN users u ON gm.uid=u.id WHERE gm.group_id=?', [req.query.groupId]) }); });
app.post('/api/group/dissolve', auth, (req, res) => { const { groupId } = req.body; const groups = query('SELECT * FROM groups WHERE id=? AND owner_uid=?', [groupId, req.uid]); if (groups.length === 0) return res.json({ code: 400, msg: '无权限' }); run('UPDATE groups SET is_dissolved=1 WHERE id=?', [groupId]); run('DELETE FROM group_members WHERE group_id=?', [groupId]); res.json({ code: 200, msg: '群已解散' }); });
app.post('/api/group/remove_member', auth, (req, res) => { const { groupId, memberUid } = req.body; const groups = query('SELECT * FROM groups WHERE id=? AND owner_uid=?', [groupId, req.uid]); if (groups.length === 0) return res.json({ code: 400, msg: '无权限' }); run('DELETE FROM group_members WHERE group_id=? AND uid=?', [groupId, memberUid]); res.json({ code: 200, msg: '已移除' }); });

// ====================== 朋友圈 ======================
app.get('/api/moments', auth, (req, res) => {
  const moments = query(`SELECT m.*, u.nickname, u.avatar FROM moments m LEFT JOIN users u ON m.uid=u.id WHERE m.uid IN (SELECT friend_uid FROM friends WHERE uid=? AND status=1) OR m.uid=? ORDER BY m.create_time DESC LIMIT 50`, [req.uid, req.uid]);
  res.json({ code: 200, data: moments.map(m => ({ ...m, images: JSON.parse(m.images || '[]'), likes: query('SELECT u.id, u.nickname FROM moment_likes ml LEFT JOIN users u ON ml.uid=u.id WHERE moment_id=?', [m.id]), comments: query('SELECT c.*, u.nickname FROM moment_comments c LEFT JOIN users u ON c.uid=u.id WHERE moment_id=?', [m.id]) })) });
});

app.post('/api/moments/publish', auth, (req, res) => { const { content, images = [] } = req.body; res.json({ code: 200, msg: '发布成功', data: { id: run('INSERT INTO moments (uid, content, images) VALUES (?,?,?)', [req.uid, content, JSON.stringify(images)]).lastID } }); });
app.post('/api/moments/like', auth, (req, res) => { const { momentId } = req.body; const exist = query('SELECT id FROM moment_likes WHERE uid=? AND moment_id=?', [req.uid, momentId]); if (exist.length > 0) { run('DELETE FROM moment_likes WHERE uid=? AND moment_id=?', [req.uid, momentId]); run('UPDATE moments SET like_count=like_count-1 WHERE id=?', [momentId]); } else { run('INSERT INTO moment_likes (uid, moment_id) VALUES (?,?)', [req.uid, momentId]); run('UPDATE moments SET like_count=like_count+1 WHERE id=?', [momentId]); } res.json({ code: 200, msg: '操作成功' }); });
app.post('/api/moments/comment', auth, (req, res) => { const { momentId, content } = req.body; run('INSERT INTO moment_comments (uid, moment_id, content) VALUES (?,?,?)', [req.uid, momentId, content]); run('UPDATE moments SET comment_count=comment_count+1 WHERE id=?', [momentId]); res.json({ code: 200, msg: '评论成功' }); });

// ====================== 跑腿 ======================
app.get('/api/run/orders', auth, (req, res) => { const { status, my, type } = req.query; let sql = 'SELECT r.*, u.nickname as publisher_name, u.avatar as publisher_avatar FROM run_orders r LEFT JOIN users u ON r.uid=u.id WHERE 1=1'; const params = []; if (my === 'true') { sql += ' AND (r.uid=? OR r.runner_uid=?)'; params.push(req.uid, req.uid); } else if (status !== undefined) { sql += ' AND r.status=?'; params.push(status); } else { sql += ' AND r.status=0'; } if (type) { sql += ' AND r.type=?'; params.push(type); } res.json({ code: 200, data: query(sql + ' ORDER BY r.create_time DESC LIMIT 50', params) }); });
app.post('/api/run/publish', auth, (req, res) => { const { title, detail, fee, fromAddr, toAddr, type = 'run' } = req.body; run('INSERT INTO run_orders (uid, title, detail, fee, from_addr, to_addr, type) VALUES (?,?,?,?,?,?,?)', [req.uid, title, detail, fee, fromAddr, toAddr, type]); res.json({ code: 200, msg: '发布成功' }); });
app.post('/api/run/take', auth, (req, res) => { run('UPDATE run_orders SET status=1, runner_uid=? WHERE id=? AND status=0', [req.uid, req.body.orderId]); res.json({ code: 200, msg: '接单成功' }); });
app.post('/api/run/finish', auth, (req, res) => { const { orderId } = req.body; const orders = query('SELECT uid, fee FROM run_orders WHERE id=?', [orderId]); if (orders.length === 0) return res.json({ code: 400, msg: '订单不存在' }); run('UPDATE users SET money=money-? WHERE id=?', [orders[0].fee, orders[0].uid]); run('UPDATE users SET money=money+? WHERE id=?', [orders[0].fee, req.uid]); run('UPDATE run_orders SET status=2 WHERE id=?', [orderId]); res.json({ code: 200, msg: '订单完成，费用已结算' }); });

// ====================== 骑手 ======================
app.post('/api/rider/auth', auth, (req, res) => { const { name, idCard, phone } = req.body; if (query('SELECT id FROM rider_auth WHERE uid=?', [req.uid]).length > 0) return res.json({ code: 400, msg: '已提交申请' }); run('INSERT INTO rider_auth (uid, name, id_card, phone) VALUES (?,?,?,?)', [req.uid, name, idCard, phone]); res.json({ code: 200, msg: '申请已提交' }); });
app.get('/api/rider/rank', auth, (req, res) => { res.json({ code: 200, data: query('SELECT u.id, u.nickname, u.avatar, COUNT(r.id) as order_count FROM users u LEFT JOIN run_orders r ON r.runner_uid=u.id AND r.status=2 WHERE r.id IS NOT NULL GROUP BY u.id ORDER BY order_count DESC LIMIT 10') }); });

// ====================== 商家 ======================
app.post('/api/shop/apply', auth, (req, res) => { const { name, phone, address } = req.body; if (query('SELECT id FROM shops WHERE uid=?', [req.uid]).length > 0) return res.json({ code: 400, msg: '已有店铺' }); run('INSERT INTO shops (uid, name, phone, address) VALUES (?,?,?,?)', [req.uid, name, phone, address]); res.json({ code: 200, msg: '申请已提交' }); });
app.get('/api/shops', auth, (req, res) => { res.json({ code: 200, data: query('SELECT * FROM shops WHERE status=1') }); });

// ====================== 地址 ======================
app.get('/api/addresses', auth, (req, res) => { res.json({ code: 200, data: query('SELECT * FROM addresses WHERE uid=? ORDER BY is_default DESC', [req.uid]) }); });
app.post('/api/addresses/add', auth, (req, res) => { const { name, phone, address, isDefault } = req.body; if (isDefault) run('UPDATE addresses SET is_default=0 WHERE uid=?', [req.uid]); run('INSERT INTO addresses (uid, name, phone, address, is_default) VALUES (?,?,?,?,?)', [req.uid, name, phone, address, isDefault ? 1 : 0]); res.json({ code: 200, msg: '添加成功' }); });

// ====================== 支付 ======================
app.get('/api/pay/wallet', auth, (req, res) => { res.json({ code: 200, data: { money: query('SELECT money FROM users WHERE id=?', [req.uid])[0]?.money || 0 } }); });
app.post('/api/pay/recharge', auth, (req, res) => { run('UPDATE users SET money=money+? WHERE id=?', [req.body.amount, req.uid]); res.json({ code: 200, msg: '充值成功' }); });
app.post('/api/pay/withdraw', auth, (req, res) => { const { amount } = req.body; const users = query('SELECT money FROM users WHERE id=?', [req.uid]); if (users[0].money < amount) return res.json({ code: 400, msg: '余额不足' }); run('UPDATE users SET money=money-? WHERE id=?', [amount, req.uid]); res.json({ code: 200, msg: '提现申请已提交' }); });

// ====================== 上传 ======================
app.post('/api/upload', upload.single('file'), (req, res) => { if (!req.file) return res.json({ code: 400, msg: '上传失败' }); res.json({ code: 200, data: { url: `http://localhost:3000/uploads/${req.file.filename}` } }); });

// ====================== Admin Back-end (Patch 7.5 scaffold) ======================
// In-memory admin tenants store with basic CRUD, optionally persisting to DB in future.
let adminTenantsLive = [
  { id: 't1', name: 'Campus Tech Co', status: 'Active' },
  { id: 't2', name: 'Library Services', status: 'Active' }
];
app.get('/api/admin/stats', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { res.json({ code: 200, data: { userCount: query('SELECT COUNT(*) as cnt FROM users')[0]?.cnt || 0, orderCount: query('SELECT COUNT(*) as cnt FROM run_orders')[0]?.cnt || 0, totalMoney: query('SELECT SUM(fee) as total FROM run_orders WHERE status=2')[0]?.total || 0, onlineCount: query('SELECT COUNT(*) as cnt FROM users WHERE online=1')[0]?.cnt || 0 } }); });
// Tenant management endpoints (CRUD)
  try {
    const rows = query('SELECT id, name, status, description FROM admin_tenants ORDER BY create_time DESC');
    res.json({ code: 200, tenants: rows });
  } catch (e) {
    res.json({ code: 500, msg: '查询失败' });
  }
});

// Get a single tenant by id - Patch 7.5+2
app.get('/api/admin/tenants/:id', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  const id = req.params.id;
  try {
    const rows = query('SELECT id, name, status, description FROM admin_tenants WHERE id=?', [id]);
    if (rows.length > 0) return res.json({ code: 200, tenant: rows[0] });
    res.json({ code: 404, msg: '未找到租户' });
  } catch (e) {
    res.json({ code: 500, msg: '查询失败' });
  }
});

// Admin migrations list (health/observability) - Patch 7.5+
app.get('/api/admin/migrations/list', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  try {
    const rows = query('SELECT version, description, applied_at FROM admin_migrations ORDER BY version DESC');
    res.json({ code: 200, migrations: rows });
  } catch (e) {
    res.json({ code: 500, msg: '查询失败' });
  }
});

// Admin migrations latest (health/observability) - Patch 7.5+
app.get('/api/admin/migrations', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  try {
    const row = query('SELECT version, description, applied_at FROM admin_migrations ORDER BY version DESC LIMIT 1')[0];
    res.json({ code: 200, migrations: row ? [row] : [] });
  } catch (e) {
    res.json({ code: 500, msg: '查询失败' });
  }
});

// Search tenants by name or description (Admin) - Patch 7.5+2
app.get('/api/admin/tenants/search', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  const q = req.query.q || '';
  try {
    const rows = query('SELECT id, name, status, description FROM admin_tenants WHERE name LIKE ? OR description LIKE ? ORDER BY create_time DESC', [`%${q}%`, `%${q}%`]);
    res.json({ code: 200, tenants: rows });
  } catch (e) {
    res.json({ code: 500, msg: '查询失败' });
  }
});

// Get a single tenant by id - Patch 7.5+2
app.get('/api/admin/tenants/:id', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  const id = req.params.id;
  try {
    const rows = query('SELECT id, name, status, description FROM admin_tenants WHERE id=?', [id]);
    if (rows.length > 0) return res.json({ code: 200, tenant: rows[0] });
    res.json({ code: 404, msg: '未找到租户' });
  } catch (e) {
    res.json({ code: 500, msg: '查询失败' });
  }
});

// Admin migrations status
app.get('/api/admin/migrations', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  try {
    const ver = query('SELECT MAX(version) as v FROM admin_migrations')[0]?.v || 0;
    res.json({ code: 200, version: ver });
  } catch (e) {
    res.json({ code: 500, msg: '查询失败' });
  }
});
app.post('/api/admin/tenants', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  const { name, status = 'Active' } = req.body;
  if (!name) return res.json({ code: 400, msg: '名称必填' });
  const id = uuidv4();
  try {
    run('INSERT INTO admin_tenants (id, name, status) VALUES (?,?,?)', [id, name, status]);
    res.json({ code: 200, msg: '创建成功', data: { id, name, status } });
  } catch (e) {
    res.json({ code: 500, msg: '创建失败' });
  }
});
app.put('/api/admin/tenants/:id', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  const id = req.params.id;
  const { name, status } = req.body;
  try {
    run('UPDATE admin_tenants SET name=?, status=? WHERE id=?', [name, status, id]);
    res.json({ code: 200, msg: '更新成功', data: { id, name, status } });
  } catch (e) {
    res.json({ code: 500, msg: '更新失败' });
  }
});
app.delete('/api/admin/tenants/:id', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => {
  const id = req.params.id;
  try {
    run('DELETE FROM admin_tenants WHERE id=?', [id]);
    res.json({ code: 200, msg: '删除成功' });
  } catch (e) {
    res.json({ code: 500, msg: '删除失败' });
  }
});
app.get('/api/admin/users', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { const { page = 1, limit = 20 } = req.query; res.json({ code: 200, data: { list: query('SELECT * FROM users LIMIT ? OFFSET ?', [parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]), total: query('SELECT COUNT(*) as cnt FROM users')[0]?.cnt || 0 } }); });
app.post('/api/admin/user/freeze', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { const { userId, status } = req.body; run('UPDATE users SET status=? WHERE id=?', [status, userId]); res.json({ code: 200, msg: '操作成功' }); });
app.get('/api/admin/orders', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { res.json({ code: 200, data: query('SELECT r.*, u.nickname as publisher_name FROM run_orders r LEFT JOIN users u ON r.uid=u.id ORDER BY r.create_time DESC LIMIT 50') }); });
app.get('/api/admin/rider_auths', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { res.json({ code: 200, data: query('SELECT ra.*, u.nickname, u.avatar FROM rider_auth ra LEFT JOIN users u ON ra.uid=u.id WHERE ra.status=0') }); });
app.post('/api/admin/rider_auth/audit', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { run('UPDATE rider_auth SET status=? WHERE id=?', [req.body.status, req.body.authId]); res.json({ code: 200, msg: '审核完成' }); });
app.get('/api/admin/groups', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { res.json({ code: 200, data: query('SELECT g.*, u.nickname as owner_name, (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as member_count FROM groups g LEFT JOIN users u ON g.owner_uid=u.id') }); });
app.post('/api/admin/group/dissolve', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { run('UPDATE groups SET is_dissolved=1 WHERE id=?', [req.body.groupId]); run('DELETE FROM group_members WHERE group_id=?', [req.body.groupId]); res.json({ code: 200, msg: '已解散' }); });
app.get('/api/admin/notices', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { res.json({ code: 200, data: query('SELECT * FROM notices ORDER BY create_time DESC') }); });
app.post('/api/admin/notices/add', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { run('INSERT INTO notices (title, content) VALUES (?,?)', [req.body.title, req.body.content]); res.json({ code: 200, msg: '发布成功' }); });
app.get('/api/admin/banners', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { res.json({ code: 200, data: query('SELECT * FROM banners ORDER BY sort DESC') }); });
app.post('/api/admin/banners/add', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { const { title, image, url, sort = 0 } = req.body; run('INSERT INTO banners (title, image, url, sort) VALUES (?,?,?,?)', [title, image, url, sort]); res.json({ code: 200, msg: '添加成功' }); });
app.get('/api/admin/logs', adminAuth, requireAdminRole(['super_admin','tenant_admin']), (req, res) => { res.json({ code: 200, data: query('SELECT l.*, a.username FROM logs l LEFT JOIN admins a ON l.admin_id=a.id ORDER BY l.create_time DESC LIMIT 50') }); });
app.get('/api/notices', auth, (req, res) => { res.json({ code: 200, data: query('SELECT * FROM notices WHERE status=1 ORDER BY create_time DESC LIMIT 10') }); });

// ====================== 启动 ======================
initDatabase().then(() => {
  // Initialize phase 1 chat routes
  require('./server_chat_phase1')({ app, db, io, auth });
  // Initialize chat phase 1 routes (core chat + friends/groups)
  // Initialize chat phase 1 routes (core chat + friends/groups)
  require('./server_chat_phase1')({ app, db, io, auth });
  if (query('SELECT id FROM admins WHERE username=?', ['admin']).length === 0) {
    run('INSERT INTO admins (username, password, role) VALUES (?,?,?)', ['admin', bcrypt.hashSync('admin123', 10), 'super_admin']);
    console.log('✅ 默认管理员: admin / admin123');
  }
  server.listen(3000, () => { console.log('🚀 完整版校园跑腿系统启动成功'); console.log('📱 后端: http://localhost:3000'); console.log('👤 管理员: admin / admin123'); });
});
