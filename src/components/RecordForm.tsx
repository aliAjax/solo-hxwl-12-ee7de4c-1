import { useEffect, useRef, useState } from "react";
import type { CaseRecord, FormErrors, RecordFormState, RiskLevel, Topic } from "../types";
import { EMPTY_FORM, RISK_LEVELS, SAMPLE_FORM, TOPICS, hasErrors, validateForm } from "../store";

interface RecordFormProps {
  records: CaseRecord[];
  editing: CaseRecord | null;
  /** 每次成功保存后递增，用于解除提交锁并清空表单 */
  saveNonce: number;
  onSave: (form: RecordFormState, editingId: string | null) => void;
  onCancelEdit: () => void;
}

function toForm(record: CaseRecord): RecordFormState {
  return {
    clientCode: record.clientCode,
    topic: record.topic,
    risk: record.risk,
    sessionDate: record.sessionDate,
    concerns: record.concerns,
    emotion: record.emotion,
    intervention: record.intervention,
    nextGoal: record.nextGoal,
  };
}

export default function RecordForm({ records, editing, saveNonce, onSave, onCancelEdit }: RecordFormProps) {
  const [form, setForm] = useState<RecordFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  // 进入/退出编辑态、或成功保存后同步表单并解除提交锁
  useEffect(() => {
    setForm(editing ? toForm(editing) : EMPTY_FORM);
    setErrors({});
    inFlightRef.current = false;
    setSubmitting(false);
  }, [editing, saveNonce]);

  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const update = <K extends keyof RecordFormState>(key: K, value: RecordFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // 防止重复提交：in-flight 守卫 + 按钮禁用双保险，绝不产生空记录
    if (inFlightRef.current) return;
    const nextErrors = validateForm(form, records, editing?.id ?? null);
    if (hasErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }
    inFlightRef.current = true;
    setSubmitting(true);
    // 规范化后的快照提交，避免异步过程中表单被改动
    const snapshot: RecordFormState = {
      clientCode: form.clientCode.trim(),
      topic: form.topic,
      risk: form.risk,
      sessionDate: form.sessionDate,
      concerns: form.concerns.trim(),
      emotion: form.emotion.trim(),
      intervention: form.intervention.trim(),
      nextGoal: form.nextGoal.trim(),
    };
    onSave(snapshot, editing?.id ?? null);
  };

  const fieldError = (key: keyof FormErrors) =>
    errors[key] ? <em className="field-error">{errors[key]}</em> : null;

  const inputClass = (key: keyof FormErrors) => (errors[key] ? "invalid" : undefined);

  return (
    <form className="record-form" onSubmit={handleSubmit} noValidate>
      <div className="field-grid">
        <label>
          <span>
            来访者代号 <b className="req">*</b>
          </span>
          <input
            className={inputClass("clientCode")}
            value={form.clientCode}
            maxLength={20}
            placeholder="如 C-042"
            onChange={(e) => update("clientCode", e.target.value)}
          />
          {fieldError("clientCode")}
        </label>

        <label>
          <span>
            会谈日期 <b className="req">*</b>
          </span>
          <input
            type="date"
            className={inputClass("sessionDate")}
            value={form.sessionDate}
            max={maxDate}
            onChange={(e) => update("sessionDate", e.target.value)}
          />
          {fieldError("sessionDate")}
        </label>

        <label>
          <span>
            咨询主题 <b className="req">*</b>
          </span>
          <select
            className={inputClass("topic")}
            value={form.topic}
            onChange={(e) => update("topic", e.target.value as Topic | "")}
          >
            <option value="">请选择咨询主题</option>
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {fieldError("topic")}
        </label>

        <label>
          <span>
            风险等级 <b className="req">*</b>
          </span>
          <select
            className={inputClass("risk")}
            value={form.risk}
            onChange={(e) => update("risk", e.target.value as RiskLevel | "")}
          >
            <option value="">请选择风险等级</option>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {fieldError("risk")}
        </label>

        <label className="field-wide">
          <span>
            主要困扰 <b className="req">*</b>
          </span>
          <textarea
            className={inputClass("concerns")}
            rows={2}
            maxLength={1000}
            placeholder="填写主要困扰"
            value={form.concerns}
            onChange={(e) => update("concerns", e.target.value)}
          />
          {fieldError("concerns")}
        </label>

        <label>
          <span>
            情绪状态 <b className="req">*</b>
          </span>
          <input
            className={inputClass("emotion")}
            maxLength={1000}
            placeholder="填写情绪状态"
            value={form.emotion}
            onChange={(e) => update("emotion", e.target.value)}
          />
          {fieldError("emotion")}
        </label>

        <label>
          <span>
            干预方法 <b className="req">*</b>
          </span>
          <input
            className={inputClass("intervention")}
            maxLength={1000}
            placeholder="填写干预方法"
            value={form.intervention}
            onChange={(e) => update("intervention", e.target.value)}
          />
          {fieldError("intervention")}
        </label>

        <label className="field-wide">
          <span>下次目标（选填）</span>
          <textarea
            className={inputClass("nextGoal")}
            rows={2}
            maxLength={300}
            placeholder="填写下次目标"
            value={form.nextGoal}
            onChange={(e) => update("nextGoal", e.target.value)}
          />
          {fieldError("nextGoal")}
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-action" disabled={submitting}>
          {submitting ? "保存中…" : editing ? "保存修改" : "保存记录"}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(editing ? toForm(editing) : EMPTY_FORM);
            setErrors({});
          }}
          disabled={submitting}
        >
          重置
        </button>
        <button
          type="button"
          className="sample-fill"
          title="示例入口：一键填入示例内容"
          onClick={() => {
            setForm(SAMPLE_FORM);
            setErrors({});
          }}
          disabled={submitting}
        >
          填入示例
        </button>
        {editing && (
          <button type="button" className="cancel-edit" onClick={onCancelEdit} disabled={submitting}>
            取消编辑
          </button>
        )}
      </div>
    </form>
  );
}
