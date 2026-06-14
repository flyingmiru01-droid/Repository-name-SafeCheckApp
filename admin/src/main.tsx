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
  serverTimestamp,
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
  const [tab, setTab] = useState<"cases" | "reviews">("cases");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rejectTarget, setRejectTarget] = useState<CaseItem | null>(null);
  const [rejectReason, setRejectReason] = useState("照片模糊");
  const [customRejectReason, setCustomRejectReason] = useState("");

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

  async function changeStatus(
    firebaseId: string,
    status: "VERIFIED" | "REJECTED" | "PENDING",
    note?: string
  ) {
    await updateDoc(doc(db, "cases", firebaseId), {
      status,
      reviewer: "Admin",
      reviewedAt: serverTimestamp(),
      reviewNote:
        note ||
        (status === "VERIFIED"
          ? "管理員已核准"
          : status === "REJECTED"
          ? "管理員已拒絕"
          : "退回待查證"),
    });

    await loadCases();
  }

  async function confirmReject() {
    if (!rejectTarget) return;

    const finalReason =
      rejectReason === "其他"
        ? customRejectReason.trim() || "其他原因"
        : rejectReason;

    await changeStatus(rejectTarget.firebaseId, "REJECTED", finalReason);

    setRejectTarget(null);
    setRejectReason("照片模糊");
    setCustomRejectReason("");
  }

  useEffect(() => {
    loadCases();
  }, []);

  const reviewLogs = cases
    .filter((item) => item.reviewedAt || item.reviewer || item.reviewNote)
    .map((item) => {
      const reviewedAt: any = item.reviewedAt as any;
      const time =
        reviewedAt?.toDate
          ? reviewedAt.toDate().toLocaleString("zh-TW")
          : "未提供時間";

      return {
        id: item.id || item.firebaseId,
        plate: item.plate || "未提供",
        reviewer: item.reviewer || "Admin",
        status: statusText(item.status),
        note: item.reviewNote || "無備註",
        time,
      };
    });


  const filteredCases = cases.filter((item) => {
    const keyword = search.trim().toLowerCase();

    const matchSearch =
      !keyword ||
      String(item.name || "").toLowerCase().includes(keyword) ||
      String(item.plate || "").toLowerCase().includes(keyword) ||
      String(item.id || "").toLowerCase().includes(keyword);

    const status = String(item.status || "").trim().toUpperCase();

    const matchStatus =
      statusFilter === "ALL" ||
      status === statusFilter;

    return matchSearch && matchStatus;
  });

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

      <nav className="adminTabs">
        <button
          className={tab === "cases" ? "tabActive" : ""}
          onClick={() => setTab("cases")}
        >
          案件審核
        </button>
        <button
          className={tab === "reviews" ? "tabActive" : ""}
          onClick={() => setTab("reviews")}
        >
          審核紀錄
        </button>
      </nav>

      {tab === "cases" ? (
        <>
      
<div className="filterBar">
  <input
    placeholder="搜尋姓名 / 車牌 / 案件編號"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />

  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
  >
    <option value="ALL">全部</option>
    <option value="PENDING">待查證</option>
    <option value="VERIFIED">已驗證</option>
    <option value="REJECTED">已拒絕</option>
  </select>
</div>

<div className="summary">

        <div>總案件：{cases.length}</div>
        <div>待查證：{cases.filter((x) => (x.status || "").trim().toUpperCase() === "PENDING").length}</div>
        <div>已驗證：{cases.filter((x) => (x.status || "").trim().toUpperCase() === "VERIFIED").length}</div>
        <div>已拒絕：{cases.filter((x) => (x.status || "").trim().toUpperCase() === "REJECTED").length}</div>
      </div>

        </>
      ) : null}

      {tab === "reviews" ? (
      <section className="reviewPanel">
        <div className="reviewHeader">
          <div>
            <p className="system">AUDIT TRAIL</p>
            <h2>審核紀錄</h2>
          </div>
          <span>共 {reviewLogs.length} 筆</span>
        </div>

        {reviewLogs.length === 0 ? (
          <p className="emptyReview">目前尚無審核紀錄。</p>
        ) : (
          <div className="reviewList">
            {reviewLogs.map((log) => (
              <div className="reviewItem" key={`${log.id}-${log.time}`}>
                <div>
                  <b>{log.status}</b>
                  <p>{log.id}｜車號 {log.plate}</p>
                </div>
                <div>
                  <p>{log.reviewer}</p>
                  <small>{log.time}</small>
                </div>
                <div className="reviewNote">{log.note}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      ) : null}

      {rejectTarget ? (
        <div className="modalMask">
          <div className="modal">
            <h2>拒絕案件</h2>
            <p className="caseId">{rejectTarget.id || rejectTarget.firebaseId}</p>

            <label>拒絕原因</label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            >
              <option value="照片模糊">照片模糊</option>
              <option value="資料不足">資料不足</option>
              <option value="重複案件">重複案件</option>
              <option value="無法驗證">無法驗證</option>
              <option value="其他">其他（手動輸入）</option>
            </select>

            {rejectReason === "其他" ? (
              <textarea
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                placeholder="請輸入拒絕原因"
              />
            ) : null}

            <div className="modalActions">
              <button className="reject" onClick={confirmReject}>
                確認拒絕
              </button>
              <button className="pending" onClick={() => setRejectTarget(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {filteredCases.map((item) => (
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
              <button className="reject" onClick={() => setRejectTarget(item)}>
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
