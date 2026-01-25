
import { useLocalSearchParams } from "expo-router";
import AgentTab from "../(tabs)/agent";

export default function AgentIdScreen() {
    const local = useLocalSearchParams();

  // Ensure agentId is always a string
  const agentId = Array.isArray(local?.agentId)
    ? local.agentId[0] || ""
    : local?.agentId || "";

  return (
      <AgentTab id={agentId} />
  );
}
