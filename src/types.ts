export type Role = "counselor" | "supervisor" | "admin";
export type Topic = "焦虑" | "亲密关系" | "亲子" | "职业压力";
export type RiskLevel = "稳定" | "关注" | "中风险" | "高风险";
export type RecordStatus = "active" | "pending" | "archived" | "returned";

export interface CaseRecord {
  id: string;
  clientCode: string;
  topic: Topic | "";
  risk: RiskLevel | "";
  sessionDate: string; // yyyy-mm-dd
  concerns: string;
  emotion: string;
  intervention: string;
  nextGoal: string;
  status: RecordStatus;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  archiveRequestedAt?: number;
  archivedAt?: number;
  archiveNote?: string;
  returnNote?: string;
  isSample?: boolean;
}

/** 表单态：字段全部为字符串，便于受控输入 */
export interface RecordFormState {
  clientCode: string;
  topic: Topic | "";
  risk: RiskLevel | "";
  sessionDate: string;
  concerns: string;
  emotion: string;
  intervention: string;
  nextGoal: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
}

export type FormErrors = Partial<Record<keyof RecordFormState, string>>;
