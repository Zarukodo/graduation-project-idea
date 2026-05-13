const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const xss = require('xss');

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
app.use(cors());
app.use(express.json());

// 3. 防禦機制：API 速率限制
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5, 
  message: { error: '你點太快啦！請稍後再試。' }
});

// --- 📌 公開 API: 接收前端留言 ---
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

// --- 📌 管理員 API: 下面這些是你原本漏掉的靈魂 ---

// 取得所有留言
app.get('/api/admin/feedbacks', async (req, res) => {
  try {
    const snapshot = await db.ref('qna_feedbacks').once('value');
    const data = snapshot.val() || {};
    const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    res.json(list.reverse()); 
  } catch (error) {
    res.status(500).json({ error: '讀取失敗' });
  }
});

// 切換留言狀態 (隱藏/顯示)
app.patch('/api/admin/feedback/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; 
  try {
    await db.ref(`qna_feedbacks/${id}`).update({ status });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '狀態更新失敗' });
  }
});

// 切換釘選聚焦
app.patch('/api/admin/feedback/:id/pin', async (req, res) => {
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

// 一鍵重置 (刪除所有留言)
app.post('/api/admin/reset-session', async (req, res) => {
  try {
    await db.ref('qna_feedbacks').remove();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '重置失敗' });
  }
});

// 4. 啟動伺服器 (這一定要放在最後面)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 啟蒙導師後台運行中： http://localhost:${PORT}`);
});