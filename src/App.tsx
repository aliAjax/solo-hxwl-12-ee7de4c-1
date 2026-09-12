import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { CaseRecord, RecordFormState, RiskLevel, Role, Topic, User } from "./types";
import {
  PROJECT,
  RISK_LEVELS,
  ROLE_LABELS,
  STATUS_FILTERS,
  TOPICS,
  computeMetrics,
  exportRecordsCsv,
  loadCurrentUserId,
  loadRecords,
  loadUsers,
  saveCurrentUserId,
  saveRecords,
  saveUsers,
} from "./store";
import RecordForm from "./components/RecordForm";
import RecordList from "./components/RecordList";
import UserManager from "./components/UserManager";
import Toast from "./components/Toast";

const statusColors = ["status-ok", "status-watch", "status-danger"];
const METRIC_HINTS = ["未归档去重来访者", "中/高风险记录数", "本周（周一起）会谈", "填写了下次目标的比例"];

function MetricCard({ label, value, hint, index }: { label: string; value: string; hint: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <em className="metric-hint">{hint}</em>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

type StatusFilter = (typeof STATUS_FILTERS)[number]["key"];

export default function App() {
  const [records, setRecords] = useState<CaseRecord[]>(() => loadRecords());
  const [users, setUsers] = useState<User[]>(() => loadUsers());
  const [currentUserId, setCurrentUserId] = useState<string>(() => loadCurrentUserId());

  const [topicFilter, setTopicFilter] = useState<"all" | Topic>("all");
  const [riskFilter, setRiskFilter] = useState<"all" | RiskLevel>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [keyword, setKeyword] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveNonce, setSaveNonce] = useState(0);

  const [toast, setToast] = useState<{ message: string; kind: "ok" | "error" }>({ message: "", kind: "ok" });
  const toastTimer = useRef<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  /* ---------- 持久化：状态变更即写入，刷新后保留 ---------- */
  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveUsers(users), [users]);
  useEffect(() => saveCurrentUserId(currentUserId), [currentUserId]);

  // 当前用户若被删除则回退到第一个用户
  useEffect(() => {
    if (!users.some((u) => u.id === currentUserId) && users.length > 0) {
      setCurrentUserId(users[0].id);
    }
  }, [users, currentUserId]);

  const currentUser = users.find((u) => u.id === currentUserId) ?? users[0];
  const role: Role = currentUser?.role ?? "counselor";

  const showToast = (message: string, kind: "ok" | "error" = "ok") => {
    setToast({ message, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast({ message: "", kind: "ok" }), 2600);
  };

  const userNameOf = (userId: string) => users.find((u) => u.id === userId)?.name ?? "已移除用户";

  /* ---------- 指标看板（由全部记录实时计算，保存即同步） ---------- */
  const metrics = useMemo(() => computeMetrics(records), [records]);

  /* ---------- 筛选 ---------- */
  const filteredRecords = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return records.filter((r) => {
      if (topicFilter !== "all" && r.topic !== topicFilter) return false;
      if (riskFilter !== "all" && r.risk !== riskFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (kw) {
        const haystack = [r.clientCode, r.concerns, r.emotion, r.intervention, r.nextGoal]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(kw)) return false;
      }
      return true;
    });
  }, [records, topicFilter, riskFilter, statusFilter, keyword]);

  const pendingCount = records.filter((r) => r.status === "pending").length;
  const editing = records.find((r) => r.id === editingId) ?? null;

  /* ---------- 新增 / 编辑保存 ---------- */
  const handleSave = (form: RecordFormState, editingRecordId: string | null) => {
    const now = Date.now();
    if (editingRecordId) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === editingRecordId
            ? {
                ...r,
                clientCode: form.clientCode,
                topic: form.topic,
                risk: form.risk,
                sessionDate: form.sessionDate,
                concerns: form.concerns,
                emotion: form.emotion,
                intervention: form.intervention,
                nextGoal: form.nextGoal,
                updatedAt: now,
                // 退回后修改保存，仍保持已退回状态，等待咨询师重新申请归档
              }
            : r
        )
      );
      setEditingId(null);
      setSaveNonce((n) => n + 1);
      showToast(`记录 ${form.clientCode} 已更新`);
    } else {
      idCounter.current += 1;
      const newRecord: CaseRecord = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `rec-${now.toString(36)}-${idCounter.current}`,
        clientCode: form.clientCode,
        topic: form.topic,
        risk: form.risk,
        sessionDate: form.sessionDate,
        concerns: form.concerns,
        emotion: form.emotion,
        intervention: form.intervention,
        nextGoal: form.nextGoal,
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: currentUserId,
      };
      setRecords((prev) => [newRecord, ...prev]);
      setEditingId(null);
      setSaveNonce((n) => n + 1);
      showToast(`记录 ${form.clientCode} 已保存`);
    }
  };

  const startNew = () => {
    setEditingId(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startEdit = (record: CaseRecord) => {
    setEditingId(record.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ---------- 归档审批流 ---------- */
  const requestArchive = (record: CaseRecord) => {
    if (!window.confirm(`确认将来访者 ${record.clientCode} 的记录提交督导审批归档？`)) return;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? { ...r, status: "pending", archiveRequestedAt: Date.now(), updatedAt: Date.now() }
          : r
      )
    );
    showToast(`已提交 ${record.clientCode} 的归档申请`);
  };

  const withdrawArchive = (record: CaseRecord) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id ? { ...r, status: "active", archiveRequestedAt: undefined } : r
      )
    );
    showToast("已撤回归档申请");
  };

  const approveArchive = (record: CaseRecord) => {
    if (!window.confirm(`批准归档 ${record.clientCode}？归档后记录将转为只读。`)) return;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? { ...r, status: "archived", archivedAt: Date.now(), returnNote: undefined }
          : r
      )
    );
    if (editingId === record.id) setEditingId(null);
    showToast(`已批准 ${record.clientCode} 归档`);
  };

  const rejectArchive = (record: CaseRecord) => {
    const note = window.prompt(`退回 ${record.clientCode} 的归档申请，请填写退回原因（选填）：`, "");
    if (note === null) return;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...r,
              status: "returned",
              returnNote: note.trim(),
              archiveRequestedAt: undefined,
              updatedAt: Date.now(),
            }
          : r
      )
    );
    showToast(`已退回 ${record.clientCode} 的归档申请`, "error");
  };

  /* ---------- 用户与角色 ---------- */
  const changeRole = (userId: string, nextRole: Role) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (target.role === "admin" && nextRole !== "admin") {
      const adminCount = users.filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        showToast("至少需要保留一名机构管理员", "error");
        return;
      }
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    showToast(`已将 ${target.name} 的角色调整为${ROLE_LABELS[nextRole]}`);
  };

  const addUser = (name: string, newRole: Role) => {
    idCounter.current += 1;
    const user: User = { id: `user-${Date.now().toString(36)}-${idCounter.current}`, name, role: newRole };
    setUsers((prev) => [...prev, user]);
    showToast(`已添加用户 ${name}（${ROLE_LABELS[newRole]}）`);
  };

  const switchUser = (id: string) => {
    setCurrentUserId(id);
    setEditingId(null);
  };

  /* ---------- 导出 ---------- */
  const handleExport = () => {
    if (filteredRecords.length === 0) {
      showToast("当前筛选结果为空，没有可导出的记录", "error");
      return;
    }
    const scope =
      topicFilter === "all" && riskFilter === "all" && statusFilter === "all" && !keyword.trim()
        ? "全部记录"
        : "筛选结果";
    exportRecordsCsv(filteredRecords, scope);
    showToast(`已导出 ${filteredRecords.length} 条记录摘要（CSV）`);
  };

  const metricValues = [
    String(metrics.activeCases),
    String(metrics.highRisk),
    String(metrics.weeklySessions),
    metrics.goalProgress,
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {PROJECT.id} · port {PROJECT.port}
          </p>
          <h1>{PROJECT.title}</h1>
          <p className="subtitle">{PROJECT.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{PROJECT.stack}</strong>
          <span>当前身份（点击切换以体验不同权限）</span>
          <select
            className="role-switch"
            value={currentUserId}
            onChange={(e) => switchUser(e.target.value)}
            aria-label="切换当前身份"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {ROLE_LABELS[u.role]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="metrics-grid">
        {["活跃个案", "高风险关注", "本周会谈", "目标推进"].map((label, index) => (
          <MetricCard
            key={label}
            label={label}
            value={metricValues[index]}
            hint={METRIC_HINTS[index]}
            index={index}
          />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {(["counselor", "supervisor", "admin"] as Role[]).map((r) => (
              <span key={r} className={role === r ? "chip-active" : ""}>
                {ROLE_LABELS[r]}
              </span>
            ))}
          </div>

          <h2>咨询主题</h2>
          <div className="chips muted filter-chips">
            <button
              type="button"
              className={topicFilter === "all" ? "chip-on" : ""}
              onClick={() => setTopicFilter("all")}
            >
              全部
            </button>
            {TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                className={topicFilter === t ? "chip-on" : ""}
                onClick={() => setTopicFilter(topicFilter === t ? "all" : t)}
              >
                {t}
              </button>
            ))}
          </div>

          <h2>风险等级</h2>
          <div className="chips muted filter-chips">
            <button
              type="button"
              className={riskFilter === "all" ? "chip-on" : ""}
              onClick={() => setRiskFilter("all")}
            >
              全部
            </button>
            {RISK_LEVELS.map((r) => (
              <button
                key={r}
                type="button"
                className={riskFilter === r ? "chip-on" : ""}
                onClick={() => setRiskFilter(riskFilter === r ? "all" : r)}
              >
                {r}
              </button>
            ))}
          </div>
        </aside>

        <section className="panel" ref={formRef}>
          <div className="section-heading">
            <div>
              <p>{PROJECT.domain}</p>
              <h2>{role === "counselor" ? (editing ? "编辑记录" : "新增记录") : "记录录入"}</h2>
            </div>
            {role === "counselor" && (
              <button type="button" className="primary-action" onClick={startNew}>
                新增记录
              </button>
            )}
          </div>

          {role === "counselor" ? (
            <RecordForm
              records={records}
              editing={editing}
              saveNonce={saveNonce}
              onSave={handleSave}
              onCancelEdit={() => setEditingId(null)}
            />
          ) : (
            <div className="readonly-notice">
              {role === "supervisor" ? (
                <>
                  <strong>督导视角：仅可查看记录与审批归档。</strong>
                  <span>
                    当前有 <b className={pendingCount > 0 ? "warn-text" : ""}>{pendingCount}</b> 条归档申请待审批，可在下方「待审批」筛选中查看。
                  </span>
                </>
              ) : (
                <strong>管理员视角：可查看全部记录，并在下方管理用户角色；录入与归档操作请使用咨询师/督导身份。</strong>
              )}
            </div>
          )}
        </section>
      </section>

      {role === "supervisor" && pendingCount > 0 && (
        <section className="panel approval-banner">
          有 <b>{pendingCount}</b> 条记录等待归档审批，请在下方记录中逐条「批准归档」或「退回」。
        </section>
      )}

      {role === "admin" && (
        <section className="panel admin-panel">
          <div className="section-heading">
            <div>
              <p>权限管理</p>
              <h2>用户与角色分配</h2>
            </div>
          </div>
          <UserManager users={users} currentUserId={currentUserId} onChangeRole={changeRole} onAddUser={addUser} />
        </section>
      )}

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>个案记录</p>
            <h2>近期记录</h2>
          </div>
          <div className="records-toolbar">
            <input
              className="keyword-input"
              placeholder="搜索代号 / 困扰 / 目标"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="按状态筛选"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            {role === "counselor" && (
              <button type="button" className="primary-action" onClick={startNew}>
                新增记录
              </button>
            )}
            <button type="button" onClick={handleExport}>
              导出摘要
            </button>
          </div>
        </div>
        <RecordList
          records={filteredRecords}
          role={role}
          editorOf={editingId}
          userNameOf={userNameOf}
          onEdit={startEdit}
          onRequestArchive={requestArchive}
          onWithdraw={withdrawArchive}
          onApprove={approveArchive}
          onReject={rejectArchive}
        />
      </section>

      <Toast message={toast.message} kind={toast.kind} />
    </main>
  );
}
