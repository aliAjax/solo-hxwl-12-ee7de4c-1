import { useState } from "react";
import type { CaseRecord, Role } from "../types";
import {
  RISK_ORDER,
  STATUS_LABELS,
  canApprove,
  canEdit,
  canRequestArchive,
} from "../store";

interface RecordListProps {
  records: CaseRecord[];
  role: Role;
  editorOf: string | null;
  userNameOf: (userId: string) => string;
  onEdit: (record: CaseRecord) => void;
  onRequestArchive: (record: CaseRecord) => void;
  onWithdraw: (record: CaseRecord) => void;
  onApprove: (record: CaseRecord) => void;
  onReject: (record: CaseRecord) => void;
}

const riskBadgeClass: Record<string, string> = {
  稳定: "risk-stable",
  关注: "risk-watch",
  中风险: "risk-mid",
  高风险: "risk-high",
};

const statusBadgeClass: Record<string, string> = {
  active: "state-active",
  pending: "state-pending",
  archived: "state-archived",
  returned: "state-returned",
};

function formatDate(iso: string): string {
  return iso;
}

export default function RecordList({
  records,
  role,
  editorOf,
  userNameOf,
  onEdit,
  onRequestArchive,
  onWithdraw,
  onApprove,
  onReject,
}: RecordListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (records.length === 0) {
    return <div className="empty-state">没有符合筛选条件的记录。</div>;
  }

  // 按会谈日期倒序，同日期按更新时间倒序
  const sorted = [...records].sort((a, b) => {
    if (a.sessionDate !== b.sessionDate) return a.sessionDate < b.sessionDate ? 1 : -1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="record-list">
      {sorted.map((record, index) => {
        const open = expanded.has(record.id);
        const beingEdited = editorOf === record.id;
        return (
          <article
            key={record.id}
            className={`record-card${open ? " expanded" : ""}${beingEdited ? " is-editing" : ""}`}
          >
            <div className="record-main">
              <button
                type="button"
                className="record-index"
                onClick={() => toggle(record.id)}
                title={open ? "收起详情" : "展开详情"}
                aria-expanded={open}
              >
                {String(index + 1).padStart(2, "0")}
              </button>
              <div className="record-summary" onClick={() => toggle(record.id)}>
                <h3>
                  {record.clientCode}
                  {record.isSample && <span className="sample-tag">示例</span>}
                  {beingEdited && <span className="editing-tag">编辑中</span>}
                </h3>
                <p>
                  {[record.topic, record.risk, formatDate(record.sessionDate)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="record-badges">
                <span className={`badge risk-badge ${riskBadgeClass[record.risk] ?? ""}`}>
                  {record.risk}
                </span>
                <span className={`badge state-badge ${statusBadgeClass[record.status]}`}>
                  {STATUS_LABELS[record.status]}
                </span>
              </div>
            </div>

            {open && (
              <div className="record-detail">
                <dl>
                  <div>
                    <dt>主要困扰</dt>
                    <dd>{record.concerns || "—"}</dd>
                  </div>
                  <div>
                    <dt>情绪状态</dt>
                    <dd>{record.emotion || "—"}</dd>
                  </div>
                  <div>
                    <dt>干预方法</dt>
                    <dd>{record.intervention || "—"}</dd>
                  </div>
                  <div>
                    <dt>下次目标</dt>
                    <dd>{record.nextGoal || "—"}</dd>
                  </div>
                </dl>
                <p className="record-meta">
                  风险序级 {RISK_ORDER[record.risk as keyof typeof RISK_ORDER] ?? "—"} · 由{" "}
                  {userNameOf(record.createdBy)} 建档 · 最后更新{" "}
                  {new Date(record.updatedAt).toLocaleString("zh-CN", { hour12: false })}
                  {record.archiveNote ? ` · 归档说明：${record.archiveNote}` : ""}
                  {record.returnNote ? ` · 退回原因：${record.returnNote}` : ""}
                </p>
                <div className="record-actions">
                  {canEdit(role, record) && !beingEdited && (
                    <button type="button" className="btn-sm" onClick={() => onEdit(record)}>
                      编辑
                    </button>
                  )}
                  {canRequestArchive(role, record) && (
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => onRequestArchive(record)}
                    >
                      申请归档
                    </button>
                  )}
                  {role === "counselor" && record.status === "pending" && (
                    <button type="button" className="btn-sm" onClick={() => onWithdraw(record)}>
                      撤回申请
                    </button>
                  )}
                  {canApprove(role, record) && (
                    <>
                      <button type="button" className="btn-sm btn-approve" onClick={() => onApprove(record)}>
                        批准归档
                      </button>
                      <button type="button" className="btn-sm btn-reject" onClick={() => onReject(record)}>
                        退回
                      </button>
                    </>
                  )}
                  {(record.status === "archived" ||
                    record.status === "pending" ||
                    record.status === "returned") && (
                    <span className="action-hint">
                      {record.status === "archived"
                        ? "记录已归档，仅供查看"
                        : record.status === "pending"
                          ? "等待督导审批"
                          : `已退回${record.returnNote ? `：${record.returnNote}` : "，可修改后重新申请"}`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
