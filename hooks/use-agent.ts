import api from "@/utils/axios";
import { useMutation } from "@tanstack/react-query";

type Agent = {
  id: string;
  name: string;
  username: string;
  is_active: boolean;
  calculate_str: string;
  secret_pin: number;
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
  assigned_dealer: number;
};

type CreateAgentParams = {
  name: string;
  password: string;
  username: string;
  is_active: boolean;
  calculate_str: string;
  secret_pin: number;
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
  assigned_dealer: number;
};

type EditAgentParams = Partial<CreateAgentParams> & { id: string };
type DeleteAgentParams = { id: string };

const useAgent = () => {
  const createMutation = useMutation<Agent, Error, CreateAgentParams>({
    mutationFn: (payload) =>
      api.post("/agent/manage/", payload).then((res) => res.data),
  });

  const editMutation = useMutation<Agent, Error, EditAgentParams>({
    mutationFn: ({ id, ...payload }) =>
      api.patch(`/agent/manage/${id}/`, payload).then((res) => res.data),
  });

  const deleteMutation = useMutation<void, Error, DeleteAgentParams>({
    mutationFn: ({ id }) =>
      api.delete(`/agent/manage/${id}/`).then((res) => res.data),
  });

  const savePrizeConfigMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post("/agent/prize-configuration/", payload).then((res) => res.data),
  });

  const updatePrizeConfigMutation = useMutation({
    mutationFn: ({ agentId, ...payload }: any) =>
      api.patch(`/agent/prize-configuration/${agentId}/`, payload).then((res) => res.data),
  });

  return {
    // Create
    createAgent: createMutation.mutate,
    createAgentAsync: createMutation.mutateAsync,
    agentCreatingIsLoading: createMutation.isPending,
    agentCreateError: createMutation.error,
    agentCreateIsSuccess: createMutation.isSuccess,

    // Edit
    editAgent: editMutation.mutate,
    editAgentAsync: editMutation.mutateAsync,
    agentEditingIsLoading: editMutation.isPending,
    agentEditError: editMutation.error,
    agentEditIsSuccess: editMutation.isSuccess,

    // Delete
    deleteAgent: deleteMutation.mutate,
    deleteAgentAsync: deleteMutation.mutateAsync,
    agentDeletingIsLoading: deleteMutation.isPending,
    agentDeleteError: deleteMutation.error,
    agentDeleteIsSuccess: deleteMutation.isSuccess,

    // Prize Config
    saveAgentPrizeConfig: savePrizeConfigMutation.mutate,
    saveAgentPrizeConfigAsync: savePrizeConfigMutation.mutateAsync,
    updateAgentPrizeConfig: updatePrizeConfigMutation.mutate,
    updateAgentPrizeConfigAsync: updatePrizeConfigMutation.mutateAsync,
  };
};

export default useAgent;
