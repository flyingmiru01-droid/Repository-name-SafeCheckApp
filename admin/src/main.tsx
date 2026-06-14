import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import "./style.css";

const firebaseConfig = {
  apiKey: "AIzaSyDB1DG8X92_xSVw1xrcRbFnJtKCee_UDm4",
  authDomain: "safecheck-89b25.firebaseapp.com",
  projectId: "safecheck-89b25",
  storageBucket: "safecheck-89b25.firebasestorage.app",
  messagingSenderId: "203482076018",
  appId: "1:203482076018:web:4106e95e155c95342ac3eb",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

type CaseItem = {
  firebaseId: string;
  id?: string;
  name?: string;
  plate?: string;
  type?: string;
  area?: string;
  date?: string;
  status?: string;
  severity?: string;
  riskScore?: number;
  evidence?: string;
  note?: string;
  aiSummary?: string;
  profileImageUrl?: string;
  plateImageUrl?: string;
};

function statusText(status?: string) {
  const s = (status || "PENDING").trim().toUpperCase();
  if (s === "VERIFIED") return "已驗證";
  if (s === "REJECTED") return "已拒絕";
  return "待查證";
}

function severityText(severity?: string) {
  const s = (severity || "").trim().toUpperCase();
  if (s === "HIGH") return "高風險";
  if (s === "MEDIUM") return "中風險";
  if (s === "LOW") return "低風險";
  return "未知";
}

function App() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadCases() {
    setLoading(true);
    const q = query(collection(db, "cases"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setCases(
      snap.docs.map((d) => ({
        firebaseId: d.id,
        ...(d.data() as any),
      }))
    );
    setLoading(false);
  }

  async function changeStatus(firebaseId: string, status: "VERIFIED" | "REJECTED" | "PENDING") {
    await updateDoc(doc(db, "cases", firebaseId), { status });
    await loadCases();
  }

  useEffect(() => {
    loadCases();
  }, []);

  return (
    <div className="page">
      <header>
        <div>
          <p className="system">SAFE CHECK ADMIN</p>
          <h1>SafeCheck 管理後台</h1>
          <p>審核待查證案件、查看照片、核准或拒絕資料。</p>
        </div>
        <button onClick={loadCases}>{loading ? "載入中..." : "重新整理"}</button>
      </header>

      <div className="summary">
        <div>總案件：{cases.length}</div>
        <div>待查證：{cases.filter((x) => (x.status || "").trim().toUpperCase() === "PENDING").length}</div>
        <div>已驗證：{cases.filter((x) => (x.status || "").trim().toUpperCase() === "VERIFIED").length}</div>
        <div>已拒絕：{cases.filter((x) => (x.status || "").trim().toUpperCase() === "REJECTED").length}</div>
      </div>

      {cases.map((item) => (
        <section className="card" key={item.firebaseId}>
          <div className="top">
            <div>
              <p className="caseId">{item.id || item.firebaseId}</p>
              <h2>{item.plate || "未提供車號"}</h2>
              <p className="meta">
                {statusText(item.status)}｜{severityText(item.severity)}｜分數 {item.riskScore ?? 0}
              </p>
            </div>

            <div className="actions">
              <button className="ok" onClick={() => changeStatus(item.firebaseId, "VERIFIED")}>
                核准
              </button>
              <button className="reject" onClick={() => changeStatus(item.firebaseId, "REJECTED")}>
                拒絕
              </button>
              <button className="pending" onClick={() => changeStatus(item.firebaseId, "PENDING")}>
                退回待查
              </button>
            </div>
          </div>

          <div className="grid">
            <p>姓名：{item.name || "未提供"}</p>
            <p>事件類型：{item.type || "未分類"}</p>
            <p>地區：{item.area || "未知"}</p>
            <p>日期：{item.date || "未提供"}</p>
            <p>證據：{item.evidence || "未提供"}</p>
            <p>狀態原始值：{item.status || "PENDING"}</p>
          </div>

          <div className="note">
            <b>事件備註</b>
            <p>{item.note || "未填寫"}</p>
          </div>

          <div className="note">
            <b>AI 分析</b>
            <p>{item.aiSummary || "尚無 AI 分析"}</p>
          </div>

          <div className="images">
            {item.profileImageUrl ? (
              <a href={item.profileImageUrl} target="_blank">
                <span>人物照片</span>
                <img src={item.profileImageUrl} />
              </a>
            ) : null}

            {item.plateImageUrl ? (
              <a href={item.plateImageUrl} target="_blank">
                <span>車牌照片</span>
                <img src={item.plateImageUrl} />
              </a>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
