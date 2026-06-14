import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
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
  reviewer?: string;
  reviewedAt?: any;
  reviewNote?: string;
  profileImageUrl?: string;
  plateImageUrl?: string;
  editStatus?: string;
  pendingEdit?: {
    evidence?: string;
    note?: string;
    severity?: string;
    updatedBy?: string;
    updatedAt?: any;
  } | null;
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
  const [tab, setTab] = useState<"cases" | "reviews" | "stats" | "plates">("cases");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [rejectTarget, setRejectTarget] = useState<CaseItem | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
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
    reason?: string
  ) {
    const ref = doc(db, "cases", firebaseId);
    const snap = await getDoc(ref);
    const data: any = snap.exists() ? snap.data() : {};
    const pendingEdit = data.pendingEdit;

    const updateData: any = {
      status,
      reviewer: "Admin",
      reviewedAt: serverTimestamp(),
      reviewNote:
        reason ||
        (status === "VERIFIED"
          ? "管理員已核准"
          : status === "REJECTED"
          ? "管理員已拒絕"
          : "退回待查證"),
    };

    // 若使用者有送出修改申請，管理員按 VERIFIED 才正式套用修改
    if (pendingEdit && status === "VERIFIED") {
      updateData.evidence = pendingEdit.evidence || data.evidence || "未提供";
      updateData.note = pendingEdit.note || data.note || "未填寫";
      updateData.severity = pendingEdit.severity || data.severity || "MEDIUM";
      updateData.editStatus = "NONE";
      updateData.pendingEdit = null;
      updateData.reviewNote = "管理員已核准修改申請";
    }

    // 若使用者有送出修改申請，管理員按 REJECTED 就拒絕修改，但保留原案件狀態
    if (pendingEdit && status === "REJECTED") {
      updateData.status = data.status || "PENDING";
      updateData.editStatus = "NONE";
      updateData.pendingEdit = null;
      updateData.reviewNote = reason || "管理員已拒絕修改申請，原內容維持不變";
    }

    await updateDoc(ref, updateData);
    await loadCases();
  }


  async function approvePendingEdit(item: CaseItem) {
    if (!item.firebaseId || !item.pendingEdit) return;

    const pendingEdit: any = item.pendingEdit;

    await updateDoc(doc(db, "cases", item.firebaseId), {
      evidence: pendingEdit.evidence || item.evidence || "未提供",
      note: pendingEdit.note || item.note || "未填寫",
      severity: pendingEdit.severity || item.severity || "MEDIUM",
      editStatus: "NONE",
      pendingEdit: null,
      reviewer: "Admin",
      reviewedAt: serverTimestamp(),
      reviewNote: "管理員已核准修改申請",
    });

    await loadCases();
  }

  async function rejectPendingEdit(item: CaseItem) {
    if (!item.firebaseId) return;

    await updateDoc(doc(db, "cases", item.firebaseId), {
      editStatus: "NONE",
      pendingEdit: null,
      reviewer: "Admin",
      reviewedAt: serverTimestamp(),
      reviewNote: "管理員已拒絕修改申請，原內容維持不變",
    });

    await loadCases();
  }

  async function saveEdit() {
    if (!editTarget) return;

    await updateDoc(
      doc(db, "cases", editTarget.firebaseId),
      {
        name: editTarget.name,
        plate: editTarget.plate,
        type: editTarget.type,
        area: editTarget.area,
        note: editTarget.note,
        severity: editTarget.severity,
      }
    );

    setEditTarget(null);
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
        <button
          className={tab === "stats" ? "tabActive" : ""}
          onClick={() => setTab("stats")}
        >
          統計
        </button>
        <button
          className={tab === "plates" ? "tabActive" : ""}
          onClick={() => setTab("plates")}
        >
          車牌歷史
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

      {tab === "plates" ? (
        <section className="statsPanel">
          <div className="reviewHeader">
            <div>
              <p className="system">PLATE HISTORY</p>
              <h2>車牌歷史整合</h2>
            </div>
          </div>

          <div className="plateList">
            {Object.entries(
              cases.reduce((acc: Record<string, CaseItem[]>, item) => {
                const plate = String(item.plate || "未提供").trim().toUpperCase();
                if (!acc[plate]) acc[plate] = [];
                acc[plate].push(item);
                return acc;
              }, {})
            )
              .map(([plate, items]) => {
                const verified = items.filter((x) => (x.status || "").trim().toUpperCase() === "VERIFIED").length;
                const pending = items.filter((x) => (x.status || "").trim().toUpperCase() === "PENDING").length;
                const rejected = items.filter((x) => (x.status || "").trim().toUpperCase() === "REJECTED").length;
                const avgRisk = Math.round(
                  items.reduce((sum, x) => sum + (x.riskScore || 0), 0) / Math.max(1, items.length)
                );
                const maxRisk = Math.max(...items.map((x) => x.riskScore || 0));

                return { plate, items, verified, pending, rejected, avgRisk, maxRisk };
              })
              .sort((a, b) => {
                if (b.verified !== a.verified) return b.verified - a.verified;
                if (b.maxRisk !== a.maxRisk) return b.maxRisk - a.maxRisk;
                return b.items.length - a.items.length;
              })
              .map((group) => (
                <div className="plateCard" key={group.plate}>
                  <div className="plateHead">
                    <div>
                      <h2>{group.plate}</h2>
                      <p>
                        總案件 {group.items.length}｜已驗證 {group.verified}｜待查證 {group.pending}｜已拒絕 {group.rejected}
                      </p>
                    </div>
                    <div className="plateRisk">
                      平均 {group.avgRisk}
                      <span>最高 {group.maxRisk}</span>
                    </div>
                  </div>

                  <div className="plateTimeline">
                    {group.items
                      .slice()
                      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
                      .map((item) => (
                        <div className="plateTimelineItem" key={item.firebaseId}>
                          <b>{item.id || item.firebaseId}</b>
                          <span>{statusText(item.status)}｜{severityText(item.severity)}｜分數 {item.riskScore || 0}</span>
                          <p>{item.date || "未提供日期"}｜{item.type || "未分類"}｜{item.name || "未提供姓名"}</p>
                          <small>{item.reviewNote || item.note || "無備註"}</small>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {tab === "stats" ? (
        <section className="statsPanel">
          <div className="reviewHeader">
            <div>
              <p className="system">STATISTICS</p>
              <h2>案件統計</h2>
            </div>
          </div>

          <div className="statsGrid">
            <div>總案件<span>{cases.length}</span></div>
            <div>待查證<span>{cases.filter((x) => (x.status || "").trim().toUpperCase() === "PENDING").length}</span></div>
            <div>已驗證<span>{cases.filter((x) => (x.status || "").trim().toUpperCase() === "VERIFIED").length}</span></div>
            <div>已拒絕<span>{cases.filter((x) => (x.status || "").trim().toUpperCase() === "REJECTED").length}</span></div>
            <div>高風險<span>{cases.filter((x) => (x.severity || "").trim().toUpperCase() === "HIGH").length}</span></div>
            <div>中風險<span>{cases.filter((x) => (x.severity || "").trim().toUpperCase() === "MEDIUM").length}</span></div>
            <div>低風險<span>{cases.filter((x) => (x.severity || "").trim().toUpperCase() === "LOW").length}</span></div>
            <div>平均分數<span>{Math.round(cases.reduce((sum, x) => sum + (x.riskScore || 0), 0) / Math.max(1, cases.length))}</span></div>
          </div>
        </section>
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

      {editTarget ? (
        <div className="modalMask">
          <div className="modal">
            <h2>編輯案件</h2>
            <p className="caseId">{editTarget.id || editTarget.firebaseId}</p>

            <label>姓名</label>
            <input
              value={editTarget.name || ""}
              onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
            />

            <label>車牌</label>
            <input
              value={editTarget.plate || ""}
              onChange={(e) => setEditTarget({ ...editTarget, plate: e.target.value })}
            />

            <label>事件類型</label>
            <input
              value={editTarget.type || ""}
              onChange={(e) => setEditTarget({ ...editTarget, type: e.target.value })}
            />

            <label>地區</label>
            <input
              value={editTarget.area || ""}
              onChange={(e) => setEditTarget({ ...editTarget, area: e.target.value })}
            />

            <label>嚴重程度</label>
            <select
              value={editTarget.severity || "MEDIUM"}
              onChange={(e) => setEditTarget({ ...editTarget, severity: e.target.value })}
            >
              <option value="LOW">低風險</option>
              <option value="MEDIUM">中風險</option>
              <option value="HIGH">高風險</option>
            </select>

            <label>事件備註</label>
            <textarea
              value={editTarget.note || ""}
              onChange={(e) => setEditTarget({ ...editTarget, note: e.target.value })}
            />

            <div className="modalActions">
              <button className="ok" onClick={saveEdit}>
                儲存修改
              </button>
              <button className="pending" onClick={() => setEditTarget(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
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

      {tab === "cases" ? (
        <>
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
              <button className="edit" onClick={() => setEditTarget({...item})}>
                編輯
              </button>

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

          {item.pendingEdit ? (
            <div
              style={{
                border: "2px solid #f59e0b",
                padding: 12,
                borderRadius: 12,
                marginBottom: 12,
                background: "#111827",
              }}
            >
              <h3 style={{ color: "#fbbf24" }}>📝 修改申請待審核</h3>

              <p style={{ color: "#e5e7eb" }}><b>修改者：</b>{item.pendingEdit.updatedBy || "未知"}</p>
              <p style={{ color: "#e5e7eb" }}><b>新證據：</b>{item.pendingEdit.evidence || "未提供"}</p>
              <p style={{ color: "#e5e7eb" }}><b>新描述：</b>{item.pendingEdit.note || "未填寫"}</p>
              <p style={{ color: "#e5e7eb" }}><b>新風險：</b>{item.pendingEdit.severity || "MEDIUM"}</p>

              <p style={{ color: "#f87171", fontWeight: 900 }}>
                狀態：{item.editStatus || "REVIEWING"}
              </p>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="ok" onClick={() => approvePendingEdit(item)}>
                  核准修改
                </button>

                <button className="reject" onClick={() => rejectPendingEdit(item)}>
                  拒絕修改
                </button>
              </div>
            </div>
          ) : null}

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
        </>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
