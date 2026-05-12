"use client";

import React from 'react';
import Tree from 'react-d3-tree';

// 你的五階段核心架構資料
const systemData = {
  name: '啟蒙導師系統',
  attributes: { type: 'System Core' },
  children: [
    {
      name: '互動引導引擎',
      attributes: { type: 'Frontend & LLM' },
      children: [
        { name: 'Phase 1: 發現', children: [{ name: '多模態解析' }, { name: '跨領域知識映射' }, { name: '建立探索專案' }] },
        { name: 'Phase 2: 啟蒙', children: [{ name: '鎖定休閒模式' }, { name: '蘇格拉底提問' }, { name: '決策收斂' }] },
        { name: 'Phase 3: 引導學習', children: [{ name: '微型實作' }, { name: '資源即時聚合' }, { name: '陪伴式除錯' }, { name: '難度動態微調' }] },
        { name: 'Phase 4: 接軌專業', children: [{ name: '開源對接與檢索' }, { name: '避坑雷達分析' }, { name: '導師預警介入' }, { name: '降維打擊翻譯' }] },
        { name: 'Phase 5: 顧問模式', children: [{ name: '關閉保母引導' }, { name: '純技術顧問互動' }, { name: '生成啟蒙日誌' }] },
      ],
    },
    {
      name: '底層紀錄庫',
      attributes: { type: 'The Repository' },
      children: [
        { name: '狀態同步監聽' },
        { name: '1:N 探索紀錄' },
        { name: '情緒與卡關維度' },
      ],
    },
  ],
};

// 客製化節點外觀 (配合你的暗色系簡報)
const renderCustomNode = ({ nodeDatum, toggleNode }) => (
  <g>
    {/* 節點圓圈：如果有子節點就顯示淺紫色，沒有則是灰藍色 */}
    <circle 
      r="10" 
      fill={nodeDatum.children ? "#dcd6f7" : "#a6b1e1"} 
      onClick={toggleNode} 
      style={{ cursor: 'pointer', stroke: '#424874', strokeWidth: 2 }} 
    />
    
    {/* 節點主標題 */}
    <text 
      fill="#d6e5e3" 
      strokeWidth="0" 
      x="20" 
      y="5" 
      fontSize="16" 
      fontFamily="'Noto Serif TC', serif" 
      letterSpacing="1px"
    >
      {nodeDatum.name}
    </text>
    
    {/* 節點副標題 (Attributes) */}
    {nodeDatum.attributes?.type && (
      <text fill="#cacfd6" x="20" y="25" fontSize="12" fontFamily="'Inter', sans-serif">
        {nodeDatum.attributes.type}
      </text>
    )}
  </g>
);

export default function SystemTree() {
  return (
    // 外層容器必須要有明確的高寬，不然畫布會扁掉
    <div style={{ width: '100%', height: '75vh', background: 'rgba(202, 207, 214, 0.05)', borderRadius: '15px', border: '1px solid #a6b1e1' }}>
      <Tree
        data={systemData}
        orientation="horizontal"
        pathFunc="diagonal" // 這是產生 Tableau 那種滑順貝茲曲線的關鍵
        translate={{ x: 100, y: 350 }} // 預設畫布中心點，視你的螢幕大小微調
        nodeSize={{ x: 280, y: 80 }} // 節點之間的 X/Y 間距
        renderCustomNodeElement={renderCustomNode}
        separation={{ siblings: 1, nonSiblings: 1.5 }}
      />
    </div>
  );
}