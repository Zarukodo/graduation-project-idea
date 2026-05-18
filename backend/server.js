const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
const jwt = require('jsonwebtoken'); // 🚀 新增
const cookieParser = require('cookie-parser'); // 🚀 新增

// 1. 初始化 Firebase Admin
let serviceAccount;
if (process.env.FIREBASE_CREDENTIALS) {
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} else {
  serviceAccount = require('./firebase-service-account.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://graduation-project-idea-qa-default-rtdb.asia-southeast1.firebasedatabase.app" 
});

const db = admin.database();
const app = express();

// 2. 基礎 Middleware
app.use(cors({
  origin: true, // 允許前端跨網域攜帶 Cookie
  credentials: true // 關鍵：允許跨網域傳遞 Cookie
}));
app.use(express.json());
app.use(cookieParser()); // 🚀 讓 Express 看得懂 Cookie

// 從環境變數拿密碼與祕密金鑰 (本地開發如果沒有，給個預設值防呆)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || "ndhu_fallback_secret";

// 3. 防禦機制：API 速率限制
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5, 
  message: { error: '你點太快啦！請稍後再試。' }
});

// --- 📌 驗證手環的守門員 (Middleware) ---
const authMiddleware = (req, res, next) => {
  // 從瀏覽器的 Cookie 裡面拿出我們發的手環 (token)
  const token = req.cookies.admin_token;

  if (!token) {
    return res.status(401).json({ error: '拒絕存取：請先登入！' });
  }

  try {
    // 驗算數學題！看看手環有沒有被竄改過
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminUser = decoded; // 把解密後的資料帶下去
    next(); // 驗證通過，放行去下一個路由！
  } catch (error) {
    return res.status(403).json({ error: '憑證無效或已過期，請重新登入！' });
  }
};

// --- 📌 公開 API: 接收前端留言 (不鎖，大家都可發) ---
app.post('/api/submit-feedback', feedbackLimiter, async (req, res) => {
  try {
    const { author, message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: '留言內容不能為空' });
    }

    const cleanAuthor = xss(author ? author.trim() : '匿名聽眾');
    const cleanMessage = xss(message.trim());
    const currentSessionId = "session_001"; 

    const feedbackData = {
      author: cleanAuthor,
      text: cleanMessage,
      timestamp: Date.now(),
      sessionId: currentSessionId,
      status: 'visible',
      isPinned: false
    };

    const newRef = db.ref('qna_feedbacks').push();
    await newRef.set(feedbackData);
    res.status(200).json({ success: true, id: newRef.key });
  } catch (error) {
    console.error("寫入失敗:", error);
    res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// --- 📌 驗證 API: 管理員登入 (核對身分、發放手環) ---
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    // 密碼正確，簽發一個 2 小時有效的 JWT 權杖
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });

    // 把權杖塞進 HttpOnly Cookie 安全口袋裡
    res.cookie('admin_token', token, {
      httpOnly: true, // 🛑 核心安全：前端 JavaScript 偷不走這顆 Cookie，杜絕 XSS
      secure: true,   // 只在 https 下傳輸 (Render 自帶 https)
      sameSite: 'none', // 允許跨網域傳輸 Cookie (Cloudflare Pages 連到 Render)
      maxAge: 2 * 60 * 60 * 1000 // 2 小時後過期
    });

    return res.json({ success: true, message: '登入成功' });
  }

  res.status(401).json({ error: '密碼錯誤！' });
});

// --- 📌 管理員 API: 加上 authMiddleware 鎖起來！ ---

// 取得所有留言 (加鎖)
app.get('/api/admin/feedbacks', authMiddleware, async (req, res) => {
  try {
    const snapshot = await db.ref('qna_feedbacks').once('value');
    const data = snapshot.val() || {};
    const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    res.json(list.reverse()); 
  } catch (error) {
    res.status(500).json({ error: '讀取失敗' });
  }
});

// 切換留言狀態 (加鎖)
app.patch('/api/admin/feedback/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 
  try {
    await db.ref(`qna_feedbacks/${id}`).update({ status });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '狀態更新失敗' });
  }
});

// 切換釘選聚焦 (加鎖)
app.patch('/api/admin/feedback/:id/pin', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { isPinned } = req.body;
  try {
    if (isPinned) {
      const snapshot = await db.ref('qna_feedbacks').once('value');
      const data = snapshot.val() || {};
      const updates = {};
      Object.keys(data).forEach(key => {
        updates[`qna_feedbacks/${key}/isPinned`] = false;
      });
      await db.ref().update(updates);
    }
    await db.ref(`qna_feedbacks/${id}`).update({ isPinned });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '釘選失敗' });
  }
});

// 一鍵重置 (加鎖)
app.post('/api/admin/reset-session', authMiddleware, async (req, res) => {
  try {
    await db.ref('qna_feedbacks').remove();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '重置失敗' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 啟蒙導師後台運行中： http://localhost:${PORT}`);
});