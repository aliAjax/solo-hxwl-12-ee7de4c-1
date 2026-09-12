interface ToastProps {
  message: string;
  kind: "ok" | "error";
}

export default function Toast({ message, kind }: ToastProps) {
  if (!message) return null;
  return <div className={`toast toast-${kind}`} role="status">{message}</div>;
}
