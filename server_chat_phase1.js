const { v4: uuidv4 } = require('uuid');
const path = require('path');

module.exports = function({ app, db, io, auth }) {
  // 1) 发送好友申请
  // Helper: simple select wrapper for sql.js
  function select(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
  app.post('/api/friend/add', auth, (req, res) => {
    const { toUid, message } = req.body;
    if (!toUid) return res.status(400).json({ code: 400, msg: 'toUid required' });
    try {
      db.run('INSERT INTO friend_requests (from_uid, to_uid, message) VALUES (?,?,?)', [req.uid, toUid, message || '']);
      res.json({ code: 200, msg: '好友申请已发送' });
    } catch (err) {
      res.status(500).json({ code: 500, msg: '发送失败' });
    }
  });

  // 2) 获取好友申请
  app.get('/api/friend/requests', auth, (req, res) => {
    const rows = select(`SELECT fr.id, fr.from_uid, fr.to_uid, fr.status, fr.message, fr.create_time, u.nickname, u.avatar
      FROM friend_requests fr LEFT JOIN users u ON fr.from_uid = u.id
      WHERE fr.to_uid = ?`, [req.uid]);
    res.json({ code: 200, data: rows });
  });

  // 3) 同意申请
  app.post('/api/friend/requests/:id/accept', auth, (req, res) => {
    const id = req.params.id;
    db.run('UPDATE friend_requests SET status=1 WHERE id=? AND to_uid=?', [id, req.uid]);
    const rows = select('SELECT from_uid FROM friend_requests WHERE id=?', [id]);
    const fromUid = rows[0]?.from_uid;
    if (fromUid) {
      db.run('INSERT INTO friends (uid, friend_uid, status) VALUES (?,?,1)', [req.uid, fromUid]);
      db.run('INSERT INTO friends (uid, friend_uid, status) VALUES (?,?,1)', [fromUid, req.uid]);
    }
    res.json({ code: 200, msg: '已同意' });
  });

  // 4) 拒绝
  app.post('/api/friend/requests/:id/reject', auth, (req, res) => {
    const id = req.params.id;
    db.run('UPDATE friend_requests SET status=2 WHERE id=? AND to_uid=?', [id, req.uid]);
    res.json({ code: 200, msg: '已拒绝' });
  });

  // 5) 好友列表
  app.get('/api/friends', auth, (req, res) => {
    const rows = select('SELECT u.id, u.nickname, u.avatar, u.online FROM friends f LEFT JOIN users u ON f.friend_uid = u.id WHERE f.uid = ? AND f.status = 1', [req.uid]);
    res.json({ code: 200, data: rows });
  });

  // 6) 拉黑/取消拉黑
  app.post('/api/friend/block', auth, (req, res) => {
    const { blockUid } = req.body;
    db.run('INSERT IGNORE INTO blocked_users (uid, block_uid) VALUES (?,?)', [req.uid, blockUid]);
    db.run('DELETE FROM friends WHERE (uid=? AND friend_uid=?) OR (uid=? AND friend_uid=?)', [req.uid, blockUid, blockUid, req.uid]);
    res.json({ code: 200, msg: '已加入黑名单' });
  });
  app.get('/api/blocked', auth, (req, res) => {
    const rows = select('SELECT u.id, u.nickname, u.avatar FROM blocked_users b LEFT JOIN users u ON b.block_uid = u.id WHERE b.uid=?', [req.uid]);
    res.json({ code: 200, data: rows });
  });
  app.post('/api/friend/unblock', auth, (req, res) => {
    const { blockUid } = req.body;
    db.run('DELETE FROM blocked_users WHERE uid=? AND block_uid=?', [req.uid, blockUid]);
    res.json({ code: 200, msg: '已取消黑名单' });
  });

  // 7) 群聊创建
  app.post('/api/group/create', auth, (req, res) => {
    const { name, memberUids = [] } = req.body;
    const groupId = uuidv4();
    db.run('INSERT INTO groups (id, name, owner_uid) VALUES (?,?,?)', [groupId, name, req.uid]);
    db.run('INSERT INTO group_members (group_id, uid, role) VALUES (?,?,?)', [groupId, req.uid, 'owner']);
    for (const uid of memberUids) {
      db.run('INSERT INTO group_members (group_id, uid, role) VALUES (?,?,?)', [groupId, uid, 'member']);
    }
    res.json({ code: 200, data: { groupId } });
  });
  // 8) 群成员管理
  app.post('/api/group/:groupId/add_members', auth, (req, res) => {
    const { groupId } = req.params;
    const { memberUids = [] } = req.body;
    for (const uid of memberUids) db.run('INSERT INTO group_members (group_id, uid) VALUES (?,?)', [groupId, uid]);
    res.json({ code:200, msg:'成员添加完成' });
  });
  app.post('/api/group/:groupId/remove_member', auth, (req, res) => {
    const { groupId } = req.params;
    const { memberUid } = req.body;
    db.run('DELETE FROM group_members WHERE group_id=? AND uid=?', [groupId, memberUid]);
    res.json({ code:200, msg:'群成员移除' });
  });
  // 9) 解散群聊
  app.post('/api/group/:groupId/dissolve', auth, (req, res) => {
    const { groupId } = req.params;
    db.run('UPDATE groups SET is_dissolved=1 WHERE id=?', [groupId]);
    db.run('DELETE FROM group_members WHERE group_id=?', [groupId]);
    res.json({ code:200, msg:'群聊解散' });
  });
  // 10) 获取群成员
  app.get('/api/group/:groupId/members', auth, (req, res) => {
    const { groupId } = req.params;
    const rows = select('SELECT u.id, u.nickname, u.avatar, gm.role FROM group_members gm LEFT JOIN users u ON gm.uid = u.id WHERE gm.group_id=?', [groupId]);
    res.json({ code:200, data: rows });
  });
  // 11) 发送消息（私聊/群聊）
  app.post('/api/message/send', auth, (req, res) => {
    const { chatType, targetId, content, type='text', fileUrl } = req.body;
    if (chatType === 'private') {
      db.run('INSERT INTO messages (from_uid, to_uid, content, type, file_url) VALUES (?,?,?,?,?)', [req.uid, targetId, content, type, fileUrl]);
      res.json({ code: 200, msg: '发送成功' });
    } else {
      db.run('INSERT INTO messages (from_uid, group_id, content, type, file_url) VALUES (?,?,?,?,?)', [req.uid, targetId, content, type, fileUrl]);
      res.json({ code: 200, msg: '发送成功' });
    }
  });
  // 12) 历史
  app.get('/api/messages/history', auth, (req, res) => {
    const { chatType, targetId, limit = 100 } = req.query;
    if (chatType === 'private') {
      const rows = select('SELECT * FROM messages WHERE ((from_uid=? AND to_uid=?) OR (from_uid=? AND to_uid=?)) ORDER BY create_time DESC LIMIT ?', [req.uid, targetId, targetId, req.uid, limit]);
      res.json({ code:200, data: rows.reverse() });
    } else {
      const rows = select('SELECT * FROM messages WHERE group_id=? ORDER BY create_time DESC LIMIT ?', [targetId, limit]);
      res.json({ code:200, data: rows.reverse() });
    }
  });
  // 13) 提醒设置
  app.post('/api/notify/settings', auth, (req, res) => {
    const { noti, sound } = req.body;
    db.run('UPDATE users SET settings=? WHERE id=?', [JSON.stringify({ noti, sound }), req.uid]);
    res.json({ code: 200, msg: '设置已保存' });
  });
  // 14) 上传
  const multer = require('multer');
  const upload = multer({ dest: path.resolve('./uploads') });
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ code: 400, msg: '上传失败' });
    res.json({ code: 200, data: { url: `/uploads/${req.file.filename}` } });
  });

  // 15) 扫一扫入口（示意实现）
  app.post('/api/scan', auth, (req, res) => {
    const { code } = req.body;
    res.json({ code: 200, data: { type: 'scan', result: code } });
  });

  // 16) 清空聊天记录
  app.post('/api/chat/clear', auth, async (req, res) => {
    const { chatType, targetId } = req.body;
    if (chatType === 'private') {
      db.run('UPDATE messages SET is_del=1 WHERE (from_uid=? AND to_uid=?) OR (from_uid=? AND to_uid=?)', [req.uid, targetId, targetId, req.uid]);
    } else if (chatType === 'group') {
      db.run('UPDATE messages SET is_del=1 WHERE group_id=?', [targetId]);
    }
    res.json({ code: 200, msg: '聊天记录已清空' });
  });

  
};
