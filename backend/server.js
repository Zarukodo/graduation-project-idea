const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const xss = require('xss');

// 初始化 Firebase Admin
let serviceAccount;
if (process.env.FIREBASE_CREDENTIALS) {
  // 雲端環境：吃環境變數
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} else {
  // 本地環境：吃實體檔案
  serviceAccount = require('./firebase-service-account.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://graduation-project-idea-qa-default-rtdb.asia-southeast1.firebasedatabase.app" // 這是你原本的 URL
});

const db = admin.database();
const app = express();

// 基礎 Middleware
app.use(cors());
app.use(express.json());

// 防禦機制：API 速率限制 (每 IP 一分鐘最多 5 次)
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5, 
  message: { error: '你點太快啦！請稍後再試。' }
});

// 📌 API: 接收前端留言
app.post('/api/submit-feedback', feedbackLimiter, async (req, res) => {
  try {
    const { author, message } = req.body;

    // 基本驗證
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: '留言內容不能為空' });
    }

    // 🛡️ XSS 過濾：清洗惡意語法
    const cleanAuthor = xss(author ? author.trim() : '匿名聽眾');
    const cleanMessage = xss(message.trim());

    // 取得全局 SessionId (如果還沒做後台切換，先給個預設值)
    // 實務上這裡應該去資料庫讀取當前的 active sessionId
    const currentSessionId = "session_001"; 

    // 準備寫入的資料結構
    const feedbackData = {
      author: cleanAuthor,
      text: cleanMessage,
      timestamp: Date.now(),
      sessionId: currentSessionId,
      status: 'visible', // 預設可見
      isPinned: false
    };

    // 透過 Admin SDK 強制寫入 Firebase
    const newRef = db.ref('qna_feedbacks').push();
    await newRef.set(feedbackData);

    console.log(`[新增留言] ${cleanAuthor}: ${cleanMessage}`);
    res.status(200).json({ success: true, id: newRef.key });

  } catch (error) {
    console.error("寫入失敗:", error);
    res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 啟蒙導師後台運行中： http://localhost:${PORT}`);
});