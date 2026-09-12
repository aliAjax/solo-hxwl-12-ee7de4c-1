import { useState } from "react";
import type { Role, User } from "../types";
import { ROLE_LABELS } from "../store";

interface UserManagerProps {
  users: User[];
  currentUserId: string;
  onChangeRole: (userId: string, role: Role) => void;
  onAddUser: (name: string, role: Role) => void;
}

const ROLE_OPTIONS: Role[] = ["counselor", "supervisor", "admin"];

export default function UserManager({
  users,
  currentUserId,
  onChangeRole,
  onAddUser,
}: UserManagerProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("counselor");
  const [error, setError] = useState("");

  const adminCount = users.filter((u) => u.role === "admin").length;

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写用户姓名");
      return;
    }
    if (users.some((u) => u.name === trimmed)) {
      setError("已存在同名用户");
      return;
    }
    onAddUser(trimmed, role);
    setName("");
    setRole("counselor");
    setError("");
  };

  return (
    <div className="user-manager">
      <ul className="user-list">
        {users.map((u) => (
          <li key={u.id}>
            <span className="user-name">
              {u.name}
              {u.id === currentUserId && <em className="self-tag">当前身份</em>}
            </span>
            <select
              value={u.role}
              onChange={(e) => onChangeRole(u.id, e.target.value as Role)}
            >
              {ROLE_OPTIONS.map((r) => {
                // 最后一名管理员不可被降级
                const disabled = u.role === "admin" && adminCount <= 1 && r !== "admin";
                return (
                  <option key={r} value={r} disabled={disabled}>
                    {ROLE_LABELS[r]}
                    {disabled ? "（需保留至少一名管理员）" : ""}
                  </option>
                );
              })}
            </select>
          </li>
        ))}
      </ul>
      <div className="add-user">
        <input
          placeholder="新用户姓名"
          maxLength={20}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleAdd}>
          添加用户
        </button>
      </div>
      {error && <em className="field-error">{error}</em>}
    </div>
  );
}
