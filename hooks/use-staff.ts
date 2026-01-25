import api from "@/utils/axios";
import { useMutation } from "@tanstack/react-query";

type Staff = {
  id: string;
  username: string;
  is_active: boolean;
};

type CreateStaffParams = {
  password: string;
  username: string;
  is_active: boolean;
  calculate_str: string;
  secret_pin: number;
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
};

type EditStaffParams = Partial<CreateStaffParams> & { id: string };
type DeleteStaffParams = { id: string };

const useStaff = () => {
  const createMutation = useMutation<Staff, Error, CreateStaffParams>({
    mutationFn: (payload) =>
      api.post("/administrator/administrator/", payload).then((res) => res.data),
  });

  const editMutation = useMutation<Staff, Error, EditStaffParams>({
    mutationFn: ({ id, ...payload }) =>
      api.patch(`/administrator/administrator/${id}/`, payload).then((res) => res.data),
  });

  const deleteMutation = useMutation<void, Error, DeleteStaffParams>({
    mutationFn: ({ id }) =>
      api.delete(`/administrator/administrator/${id}/`).then((res) => res.data),
  });

  return {
    // Create
    createStaff: createMutation.mutate,
    createStaffAsync: createMutation.mutateAsync,
    staffCreatingIsLoading: createMutation.isPending,
    staffCreateError: createMutation.error,
    staffCreateIsSuccess: createMutation.isSuccess,

    // Edit
    editStaff: editMutation.mutate,
    editStaffAsync: editMutation.mutateAsync,
    staffEditingIsLoading: editMutation.isPending,
    staffEditError: editMutation.error,
    staffEditIsSuccess: editMutation.isSuccess,

    // Delete
    deleteStaff: deleteMutation.mutate,
    deleteStaffAsync: deleteMutation.mutateAsync,
    staffDeletingIsLoading: deleteMutation.isPending,
    staffDeleteError: deleteMutation.error,
    staffDeleteIsSuccess: deleteMutation.isSuccess,
  };
};

export default useStaff;
