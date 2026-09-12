import type {
  CaseRecord,
  FormErrors,
  RecordFormState,
  RiskLevel,
  Role,
  Topic,
  User,
} from "./types";

export const PROJECT = {
  id: "hxwl-12",
  port: 5112,
  title: "心理咨询个案记录",
  subtitle: "会谈时间线、风险等级与干预目标记录",
  stack: "React + Vite + TypeScript + CSS",
  domain: "心理咨询",
};

export const TOPICS: Topic[] = ["焦虑", "亲密关系", "亲子", "职业压力"];
export const RISK_LEVELS: RiskLevel[] = ["稳定", "关注", "中风险", "高风险"];

export const ROLE_LABELS: Record<Role, string> = {
  counselor: "咨询师",
  supervisor: "督导",
  admin: "机构管理员",
};

export const STATUS_LABELS = {
  active: "进行中",
  pending: "待审批",
  archived: "已归档",
  returned: "已退回",
} as const;

export const RISK_ORDER: Record<RiskLevel, number> = {
  稳定: 0,
  关注: 1,
  中风险: 2,
  高风险: 3,
};

/** 归档审批中可见的状态筛选 */
export const STATUS_FILTERS: Array<{ key: "all" | "active" | "pending" | "returned" | "archived"; label: string }> = [
  { key: "all", label: "全部" },
  { key: "active", label: "进行中" },
  { key: "pending", label: "待审批" },
  { key: "returned", label: "已退回" },
  { key: "archived", label: "已归档" },
];

const RECORDS_KEY = "hxwl12.caseRecords.v1";
const USERS_KEY = "hxwl12.users.v1";
const CURRENT_USER_KEY = "hxwl12.currentUserId.v1";

/* ---------------- 日期工具 ---------------- */

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function offsetDate(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

/* ---------------- 种子数据（旧示例保持可用） ---------------- */

export const SEED_USERS: User[] = [
  { id: "u-1", name: "林咨询师", role: "counselor" },
  { id: "u-2", name: "周督导", role: "supervisor" },
  { id: "u-3", name: "王管理员", role: "admin" },
];

function seedRecords(): CaseRecord[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const mk = (
    code: string,
    topic: Topic,
    risk: RiskLevel,
    sessionDate: string,
    concerns: string,
    intervention: string,
    nextGoal: string,
    daysAgo: number
  ): CaseRecord => {
    const created = new Date(today);
    created.setDate(created.getDate() - daysAgo);
    return {
      id: `seed-${code}`,
      clientCode: code,
      topic,
      risk,
      sessionDate,
      concerns,
      emotion: "整体平稳，偶有紧张",
      intervention,
      nextGoal,
      status: "active",
      createdAt: created.getTime(),
      updatedAt: created.getTime(),
      createdBy: "u-1",
      isSample: true,
    };
  };
  return [
    mk(
      "C-042",
      "焦虑",
      "中风险",
      offsetDate(-2),
      "入睡困难，工作汇报前心慌、反复检查",
      "呼吸放松练习、认知重构，识别灾难化想法",
      "睡眠改善，每日练习呼吸放松并记录焦虑评分",
      2
    ),
    mk(
      "C-119",
      "亲密关系",
      "稳定",
      offsetDate(-5),
      "与伴侣发生分歧时习惯回避沟通",
      "情绪聚焦探索，练习表达需求与感受",
      "识别沟通中的回避模式，尝试一次主动表达",
      5
    ),
    mk(
      "C-203",
      "职业压力",
      "关注",
      offsetDate(-1),
      "长期加班边界模糊，对额外委派难以拒绝",
      "边界议题讨论、行为演练拒绝话术",
      "设定下周边界练习，完成一次合理拒绝",
      1
    ),
  ];
}

/** 录入表单的示例填充（"示例入口"） */
export const SAMPLE_FORM: RecordFormState = {
  clientCode: "C-318",
  topic: "亲子",
  risk: "关注",
  sessionDate: isoDay(new Date()),
  concerns: "辅导作业时情绪失控，事后自责，孩子近期不愿主动交流",
  emotion: "焦虑伴内疚，谈及时落泪",
  intervention: "情绪调节策略、亲子沟通非暴力表达演练",
  nextGoal: "本周完成一次不带评判的倾听对话并记录",
};

export const EMPTY_FORM: RecordFormState = {
  clientCode: "",
  topic: "",
  risk: "",
  sessionDate: isoDay(new Date()),
  concerns: "",
  emotion: "",
  intervention: "",
  nextGoal: "",
};

/* ---------------- 持久化 ---------------- */

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadRecords(): CaseRecord[] {
  const stored = readJSON<CaseRecord[] | null>(RECORDS_KEY, null);
  if (stored && Array.isArray(stored) && stored.length > 0) return stored;
  // 首次访问：写入示例数据
  const seed = seedRecords();
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(seed));
  } catch {
    /* 存储不可用时仅本次会话可用 */
  }
  return seed;
}

export function saveRecords(records: CaseRecord[]): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

export function loadUsers(): User[] {
  return readJSON<User[]>(USERS_KEY, SEED_USERS);
}

export function saveUsers(users: User[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

export function loadCurrentUserId(): string {
  return readJSON<string>(CURRENT_USER_KEY, "u-1");
}

export function saveCurrentUserId(id: string): void {
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(id));
  } catch {
    /* ignore */
  }
}

/* ---------------- 编号 ---------------- */

export function nextClientCode(records: CaseRecord[]): string {
  let max = 0;
  for (const r of records) {
    const m = /^C-(\d+)$/i.exec(r.clientCode.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `C-${String(max + 1).padStart(3, "0")}`;
}

/* ---------------- 校验 ---------------- */

export function validateForm(
  form: RecordFormState,
  records: CaseRecord[],
  editingId: string | null
): FormErrors {
  const errors: FormErrors = {};
  const code = form.clientCode.trim();
  if (!code) {
    errors.clientCode = "请填写来访者代号";
  } else if (code.length > 20) {
    errors.clientCode = "代号不能超过 20 个字符";
  } else if (
    records.some((r) => r.id !== editingId && r.clientCode.trim().toLowerCase() === code.toLowerCase())
  ) {
    errors.clientCode = "该来访者代号已存在，请勿重复建档";
  }

  if (!form.topic) errors.topic = "请选择咨询主题";

  if (!form.risk) {
    errors.risk = "请选择风险等级";
  } else if (!RISK_LEVELS.includes(form.risk)) {
    errors.risk = "风险等级取值无效";
  }

  if (!form.sessionDate) {
    errors.sessionDate = "请选择会谈日期";
  } else if (isNaN(new Date(form.sessionDate + "T12:00:00").getTime())) {
    errors.sessionDate = "会谈日期格式无效";
  } else if (form.sessionDate > isoDay(new Date())) {
    errors.sessionDate = "会谈日期不能晚于今天";
  }

  if (!form.concerns.trim()) errors.concerns = "请填写主要困扰";
  if (!form.emotion.trim()) errors.emotion = "请填写情绪状态";
  if (!form.intervention.trim()) errors.intervention = "请填写干预方法";
  // 下次目标为选填，但若填写则限制长度
  if (form.nextGoal.trim().length > 300) errors.nextGoal = "下次目标不超过 300 字";
  for (const key of ["concerns", "emotion", "intervention"] as const) {
    if (form[key].trim().length > 1000) errors[key] = "内容不超过 1000 字";
  }
  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/* ---------------- 指标看板 ---------------- */

export interface DashboardMetrics {
  activeCases: number;
  highRisk: number;
  weeklySessions: number;
  goalProgress: string;
}

export function computeMetrics(records: CaseRecord[]): DashboardMetrics {
  const visible = records.filter((r) => r.status !== "archived");
  const activeCases = new Set(visible.map((r) => r.clientCode.trim())).size;
  const highRisk = visible.filter((r) => r.risk === "高风险" || r.risk === "中风险").length;

  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const day = now.getDay() === 0 ? 7 : now.getDay(); // 周一为一周起点
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  const weekStart = isoDay(monday);
  const todayStr = isoDay(now);
  const weeklySessions = records.filter(
    (r) => r.sessionDate >= weekStart && r.sessionDate <= todayStr
  ).length;

  const withGoal = records.filter((r) => r.nextGoal.trim().length > 0).length;
  const goalProgress = records.length ? Math.round((withGoal / records.length) * 100) : 0;

  return { activeCases, highRisk, weeklySessions, goalProgress: `${goalProgress}%` };
}

/* ---------------- CSV 导出 ---------------- */

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportRecordsCsv(records: CaseRecord[], scopeLabel: string): void {
  const header = [
    "来访者代号",
    "咨询主题",
    "风险等级",
    "会谈日期",
    "主要困扰",
    "情绪状态",
    "干预方法",
    "下次目标",
    "状态",
  ];
  const lines = [
    header.map(csvCell).join(","),
    ...records.map((r) =>
      [
        r.clientCode,
        r.topic,
        r.risk,
        r.sessionDate,
        r.concerns,
        r.emotion,
        r.intervention,
        r.nextGoal,
        STATUS_LABELS[r.status],
      ]
        .map((v) => csvCell(String(v ?? "")))
        .join(",")
    ),
  ];
  // BOM 保证 Excel 正确识别中文
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `个案记录摘要_${scopeLabel}_${isoDay(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- 角色 ---------------- */

export function canCreate(role: Role): boolean {
  return role === "counselor";
}
export function canEdit(role: Role, record: CaseRecord): boolean {
  return role === "counselor" && (record.status === "active" || record.status === "returned");
}
export function canRequestArchive(role: Role, record: CaseRecord): boolean {
  return role === "counselor" && (record.status === "active" || record.status === "returned");
}
export function canApprove(role: Role, record: CaseRecord): boolean {
  return role === "supervisor" && record.status === "pending";
}
