import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import { useWebSocket } from "../contexts/WebSocketContext";

export default function BackupAlerts() {
  const { addMessageListener } = useWebSocket();
  const { addToast } = useToast();
  useEffect(
    () =>
      addMessageListener((message) => {
        if (
          message.topic === "event:backup_attention" &&
          message.data?.message
        ) {
          addToast(
            `${message.data.server_name}: ${message.data.message} Open Backups to review recovery readiness.`,
            "warning",
          );
        }
      }),
    [addMessageListener, addToast],
  );
  return null;
}
