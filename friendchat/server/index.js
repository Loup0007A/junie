const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db, initIndexes } = require('./db');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'friendchat-secret-2024-change-in-prod';
const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: 5e6
});

// ─── Uploads ────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /\.(jpeg|jpg|png|gif|webp)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('Images only'));
  }
});

// ─── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadDir));

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

const adminAuth = (req, res, next) => auth(req, res, () => {
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });
});

// ─── Auth ───────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email, reason } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 chars' });
    if (password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Only letters, numbers and underscores' });

    const exists = await db.users.findOne({ username });
    const pending = await db.requests.findOne({ username, status: 'pending' });
    if (exists || pending) return res.status(409).json({ error: 'Username taken or request already pending' });

    const hashed = await bcrypt.hash(password, 12);
    await db.requests.insert({ id: uuidv4(), username, password: hashed, email: email || null, reason: reason || null, status: 'pending', createdAt: Date.now() });
    io.to('admin-room').emit('new_registration_request', { username });
    res.json({ message: 'Registration request submitted. Awaiting admin approval.' });
  } catch (err) {
    if (err.errorType === 'uniqueViolated') return res.status(409).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.users.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status === 'pending') return res.status(403).json({ error: 'Account pending admin approval' });
    if (user.status === 'rejected') return res.status(403).json({ error: 'Account request was rejected' });
    if (user.banned) return res.status(403).json({ error: 'Account has been banned' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    await db.users.update({ _id: user._id }, { $set: { lastSeen: Date.now() } });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar || null, bio: user.bio || '', muted: user.muted || false, mute_until: user.muteUntil || null } });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await db.users.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.status !== 'approved') return res.status(403).json({ error: 'Account not approved' });
    res.json({ id: user.id, username: user.username, role: user.role, avatar: user.avatar || null, bio: user.bio || '', muted: user.muted || false, mute_until: user.muteUntil || null, status: user.status });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── Users ──────────────────────────────────────────────────
app.get('/api/users', auth, async (req, res) => {
  try {
    const users = await db.users.find({ status: 'approved', banned: { $ne: true } });
    res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role, avatar: u.avatar || null, bio: u.bio || '', muted: u.muted || false, muteUntil: u.muteUntil || null, lastSeen: u.lastSeen || null })).sort((a, b) => a.username.localeCompare(b.username)));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.put('/api/users/profile', auth, upload.single('avatar'), async (req, res) => {
  try {
    const updates = {};
    if (req.body.bio !== undefined) updates.bio = req.body.bio.slice(0, 200);
    if (req.file) updates.avatar = `/uploads/${req.file.filename}`;
    await db.users.update({ id: req.user.id }, { $set: updates });
    const user = await db.users.findOne({ id: req.user.id });
    res.json({ id: user.id, username: user.username, role: user.role, avatar: user.avatar || null, bio: user.bio || '' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── Messages ───────────────────────────────────────────────
app.get('/api/messages/global', auth, async (req, res) => {
  try {
    const msgs = await db.messages.find({ room: 'global', deleted: { $ne: true } }).sort({ createdAt: 1 }).limit(100);
    // Attach avatars
    const userIds = [...new Set(msgs.map(m => m.senderId))];
    const users = await db.users.find({ id: { $in: userIds } });
    const avatarMap = {};
    users.forEach(u => avatarMap[u.id] = u.avatar || null);
    res.json(msgs.map(m => ({ id: m.id, room: m.room, sender_id: m.senderId, sender_name: m.senderName, content: m.content, type: m.type || 'text', created_at: m.createdAt, deleted: m.deleted || false, avatar: avatarMap[m.senderId] || null })));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/messages/private/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const msgs = await db.privateMessages.find({
      $or: [{ senderId: req.user.id, receiverId: userId }, { senderId: userId, receiverId: req.user.id }],
      deleted: { $ne: true }
    }).sort({ createdAt: 1 }).limit(100);

    // Mark as read
    await db.privateMessages.update({ senderId: userId, receiverId: req.user.id, read: false }, { $set: { read: true } }, { multi: true });

    const userIds = [...new Set(msgs.map(m => m.senderId))];
    const users = await db.users.find({ id: { $in: userIds } });
    const avatarMap = {};
    users.forEach(u => avatarMap[u.id] = u.avatar || null);

    res.json(msgs.map(m => ({ id: m.id, sender_id: m.senderId, sender_name: m.senderName, receiver_id: m.receiverId, content: m.content, type: m.type || 'text', created_at: m.createdAt, read: m.read || false, deleted: m.deleted || false, avatar: avatarMap[m.senderId] || null })));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/messages/unread', auth, async (req, res) => {
  try {
    const msgs = await db.privateMessages.find({ receiverId: req.user.id, read: false, deleted: { $ne: true } });
    const counts = {};
    msgs.forEach(m => counts[m.senderId] = (counts[m.senderId] || 0) + 1);
    res.json(Object.entries(counts).map(([sender_id, count]) => ({ sender_id, count })));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── Admin ──────────────────────────────────────────────────
app.get('/api/admin/requests', adminAuth, async (req, res) => {
  try {
    const reqs = await db.requests.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json(reqs.map(r => ({ id: r.id, username: r.username, email: r.email, reason: r.reason, status: r.status, created_at: r.createdAt })));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/requests/:id/approve', adminAuth, async (req, res) => {
  try {
    const request = await db.requests.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ error: 'Not found' });
    const userId = uuidv4();
    await db.users.insert({ id: userId, username: request.username, password: request.password, email: request.email, role: 'user', status: 'approved', avatar: null, bio: '', muted: false, banned: false, createdAt: Date.now() });
    await db.requests.update({ id: req.params.id }, { $set: { status: 'approved' } });
    io.to('admin-room').emit('request_processed', { id: req.params.id, action: 'approved' });
    res.json({ message: 'User approved' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/requests/:id/reject', adminAuth, async (req, res) => {
  try {
    await db.requests.update({ id: req.params.id }, { $set: { status: 'rejected' } });
    io.to('admin-room').emit('request_processed', { id: req.params.id, action: 'rejected' });
    res.json({ message: 'Rejected' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const users = await db.users.find({}).sort({ createdAt: -1 });
    res.json(users.map(u => ({ id: u.id, username: u.username, email: u.email || null, role: u.role, status: u.status, avatar: u.avatar || null, muted: u.muted || false, mute_until: u.muteUntil || null, banned: u.banned || false, created_at: u.createdAt, last_seen: u.lastSeen || null })));
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/users/:id/ban', adminAuth, async (req, res) => {
  try {
    const u = await db.users.findOne({ id: req.params.id });
    if (!u) return res.status(404).json({ error: 'Not found' });
    if (u.role === 'admin') return res.status(403).json({ error: 'Cannot ban admin' });
    await db.users.update({ id: req.params.id }, { $set: { banned: true } });
    io.to(`user-${req.params.id}`).emit('account_banned');
    res.json({ message: 'Banned' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/users/:id/unban', adminAuth, async (req, res) => {
  try {
    await db.users.update({ id: req.params.id }, { $set: { banned: false } });
    res.json({ message: 'Unbanned' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/users/:id/mute', adminAuth, async (req, res) => {
  try {
    const { duration } = req.body;
    const muteUntil = duration > 0 ? Date.now() + duration * 60 * 1000 : null;
    await db.users.update({ id: req.params.id }, { $set: { muted: true, muteUntil } });
    io.to(`user-${req.params.id}`).emit('account_muted', { until: muteUntil });
    res.json({ message: 'Muted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/users/:id/unmute', adminAuth, async (req, res) => {
  try {
    await db.users.update({ id: req.params.id }, { $set: { muted: false, muteUntil: null } });
    io.to(`user-${req.params.id}`).emit('account_unmuted');
    res.json({ message: 'Unmuted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/users/:id/promote', adminAuth, async (req, res) => {
  try {
    await db.users.update({ id: req.params.id }, { $set: { role: 'admin' } });
    res.json({ message: 'Promoted to admin' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/users/:id/demote', adminAuth, async (req, res) => {
  try {
    const admins = await db.users.find({ role: 'admin' });
    if (admins.length <= 1) return res.status(400).json({ error: 'Cannot demote last admin' });
    await db.users.update({ id: req.params.id }, { $set: { role: 'user' } });
    res.json({ message: 'Demoted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/admin/messages/:id', adminAuth, async (req, res) => {
  try {
    await db.messages.update({ id: req.params.id }, { $set: { deleted: true } });
    io.to('global').emit('message_deleted', { id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── Upload ─────────────────────────────────────────────────
app.post('/api/upload', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ─── Serve React build ──────────────────────────────────────
app.get('*', (req, res) => {
  const idx = path.join(__dirname, '../client/build/index.html');
  fs.existsSync(idx)
    ? res.sendFile(idx)
    : res.json({ status: 'FriendChat API', hint: 'Run: cd client && npm run build' });
});

// ─── Socket.io ──────────────────────────────────────────────
const onlineUsers = new Map(); // socketId -> userInfo

async function isUserMuted(userId) {
  const u = await db.users.findOne({ id: userId });
  if (!u || !u.muted) return false;
  if (u.muteUntil && u.muteUntil < Date.now()) {
    await db.users.update({ id: userId }, { $set: { muted: false, muteUntil: null } });
    return false;
  }
  return true;
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.users.findOne({ id: decoded.id });
    if (!user || user.banned || user.status !== 'approved') return next(new Error('Access denied'));
    socket.user = user;
    next();
  } catch { next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  const user = socket.user;
  console.log(`✅ ${user.username} connected`);

  onlineUsers.set(socket.id, { userId: user.id, username: user.username, role: user.role, avatar: user.avatar || null });
  socket.join(`user-${user.id}`);
  socket.join('global');
  if (user.role === 'admin') socket.join('admin-room');
  io.emit('online_users', Array.from(onlineUsers.values()));

  socket.on('send_global_message', async ({ content, type = 'text' }) => {
    if (!content || content.length > 2000) return;
    if (await isUserMuted(user.id)) {
      const u = await db.users.findOne({ id: user.id });
      return socket.emit('muted', { until: u?.muteUntil });
    }
    const msg = { id: uuidv4(), room: 'global', senderId: user.id, senderName: user.username, content, type, createdAt: Date.now() };
    await db.messages.insert(msg);
    io.to('global').emit('new_global_message', {
      id: msg.id, room: 'global', sender_id: user.id, sender_name: user.username,
      content, type, created_at: msg.createdAt, avatar: user.avatar || null
    });
  });

  socket.on('send_private_message', async ({ receiverId, content, type = 'text' }) => {
    if (!content || !receiverId || content.length > 2000) return;
    if (await isUserMuted(user.id)) return socket.emit('muted', {});
    const receiver = await db.users.findOne({ id: receiverId, status: 'approved' });
    if (!receiver) return;
    const msg = { id: uuidv4(), senderId: user.id, senderName: user.username, receiverId, content, type, read: false, createdAt: Date.now() };
    await db.privateMessages.insert(msg);
    const out = { id: msg.id, sender_id: user.id, sender_name: user.username, receiver_id: receiverId, content, type, created_at: msg.createdAt, avatar: user.avatar || null };
    socket.emit('new_private_message', out);
    io.to(`user-${receiverId}`).emit('new_private_message', out);
  });

  socket.on('typing', ({ room, receiverId }) => {
    if (room === 'global') socket.to('global').emit('user_typing', { userId: user.id, username: user.username, room: 'global' });
    else if (receiverId) io.to(`user-${receiverId}`).emit('user_typing', { userId: user.id, username: user.username, room: `pm-${user.id}` });
  });

  socket.on('stop_typing', ({ room, receiverId }) => {
    if (room === 'global') socket.to('global').emit('user_stop_typing', { userId: user.id, room: 'global' });
    else if (receiverId) io.to(`user-${receiverId}`).emit('user_stop_typing', { userId: user.id, room: `pm-${user.id}` });
  });

  socket.on('mark_read', async ({ senderId }) => {
    await db.privateMessages.update({ senderId, receiverId: user.id, read: false }, { $set: { read: true } }, { multi: true });
  });

  socket.on('disconnect', async () => {
    console.log(`❌ ${user.username} disconnected`);
    onlineUsers.delete(socket.id);
    await db.users.update({ id: user.id }, { $set: { lastSeen: Date.now() } });
    io.emit('online_users', Array.from(onlineUsers.values()));
  });
});

// ─── Start ──────────────────────────────────────────────────
async function start() {
  await initIndexes();

  // Create default admin if not exists
  const adminExists = await db.users.findOne({ role: 'admin' });
  if (!adminExists) {
    const hashed = await bcrypt.hash('Admin1234!', 12);
    await db.users.insert({ id: uuidv4(), username: 'admin', password: hashed, email: 'admin@friendchat.local', role: 'admin', status: 'approved', avatar: null, bio: '', muted: false, banned: false, createdAt: Date.now() });
    console.log('✅ Admin account created → username: admin  password: Admin1234!');
  }

  server.listen(PORT, () => {
    console.log(`\n🚀 FriendChat running at http://localhost:${PORT}`);
    console.log(`   Client:  ${CLIENT_URL}`);
    console.log(`   Data:    ${require('path').join(__dirname, 'data')}\n`);
  });
}

start().catch(err => { console.error('Startup error:', err); process.exit(1); });
