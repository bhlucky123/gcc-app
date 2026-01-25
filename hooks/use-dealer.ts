import api from "@/utils/axios";
import { useMutation } from "@tanstack/react-query";

type Dealer = {
  id: string;
  username: string;
  is_active: boolean;
  calculate_str: string;
  secret_pin: number;
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
};

type CreateDealerParams = {
  password: string;
  username: string;
  is_active: boolean;
  calculate_str: string;
  secret_pin: number;
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
};

type EditDealerParams = Partial<CreateDealerParams> & { id: string };
type DeleteDealerParams = { id: string };

const useDealer = () => {
  const createMutation = useMutation<Dealer, Error, CreateDealerParams>({
    mutationFn: (payload) =>
      api.post("/administrator/dealer/", payload).then((res) => res.data),
  });

  const editMutation = useMutation<Dealer, Error, EditDealerParams>({
    mutationFn: ({ id, ...payload }) =>
      api.patch(`/administrator/dealer/${id}/`, payload).then((res) => res.data),
  });

  const deleteMutation = useMutation<void, Error, DeleteDealerParams>({
    mutationFn: ({ id }) =>
      api.delete(`/administrator/dealer/${id}/`).then((res) => res.data),
  });

  return {
    // Create
    createDealer: createMutation.mutate,
    createDealerAsync: createMutation.mutateAsync,
    dealerCreatingIsLoading: createMutation.isPending,
    dealerCreateError: createMutation.error,
    dealerCreateIsSuccess: createMutation.isSuccess,

    // Edit
    editDealer: editMutation.mutate,
    editDealerAsync: editMutation.mutateAsync,
    dealerEditingIsLoading: editMutation.isPending,
    dealerEditError: editMutation.error,
    dealerEditIsSuccess: editMutation.isSuccess,

    // Delete
    deleteDealer: deleteMutation.mutate,
    deleteDealerAsync: deleteMutation.mutateAsync,
    dealerDeletingIsLoading: deleteMutation.isPending,
    dealerDeleteError: deleteMutation.error,
    dealerDeleteIsSuccess: deleteMutation.isSuccess,
  };
};

export default useDealer;
