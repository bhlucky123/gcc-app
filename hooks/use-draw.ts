import api from "@/utils/axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Draw = {
  id?: number;
  name: string;
  valid_from: string;
  valid_till: string;
  cut_off_time: string;
  draw_time: string;
  color_theme: string;
  non_single_digit_price: number;
  single_digit_number_price: number;
};

const useDraw = () => {
  const queryClient = useQueryClient();

  // Always return a mutation object, never undefined
  const createDraw = useMutation({
    mutationFn: async (data: Draw) => {
      try {
        const res = await api.post("/draw/", data);
        return res?.data;
      } catch (error: any) {
        console.log("Error creating draw:", error);
        throw error?.response?.data || error?.message || "Failed to create draw.";
      }
    },
    onSuccess: (newDraw) => {
      queryClient.setQueryData<Draw[]>(["/draw/list/"], (oldDraws = []) => [
        ...oldDraws,
        newDraw,
      ]);
    },
    onError: (error) => {
      console.log("Mutation error in createDraw:", error);
      // Optionally, handle error side effects here (e.g., show toast)
    },
  });

  const updateDraw = useMutation({
    mutationFn: async (data: Draw) => {
      try {
        const res = await api.put(`/draw/${data.id}/`, data);
        return res?.data;
      } catch (error: any) {
        console.log("Error updating draw:", error);
        throw error?.response?.data || error?.message || "Failed to update draw.";
      }
    },
    onSuccess: (updatedDraw) => {
      queryClient.setQueryData<Draw[]>(["/draw/list/"], (oldDraws = []) =>
        oldDraws.map((d) => (d.id === updatedDraw.id ? updatedDraw : d))
      );
    },
    onError: (error) => {
      console.log("Mutation error in updateDraw:", error);
      // Optionally, handle error side effects here (e.g., show toast)
    },
  });

  // Defensive: always return a mutation object, never undefined
  const createDrawResult = useMutation({
    mutationFn: async ({
      draw_session,
      ...rest
    }: {
      draw_session: number;
      first_prize: string;
      second_prize: string;
      third_prize: string;
      fourth_prize: string;
      fifth_prize: string;
      complementary_prizes: string[];
    }) => {
      try {
        console.log("payload", rest);

        const res = await api.post(`/draw-result/result/${draw_session}/`, rest);
        return res?.data;
      } catch (error: any) {
        console.log("Error creating draw result:", error);
        throw error?.message?.detail || error?.message?.[0] || "Failed to create draw result.";
      }
    },
    onError: (error) => {
      console.log("Mutation error in createDrawResult:", error);
      // Optionally, handle error side effects here (e.g., show toast)
    },
  });

  const updateDrawResult = useMutation({
    mutationFn: async ({
      id,
      ...rest
    }: {
      id: number;
      first_prize: string;
      second_prize: string;
      third_prize: string;
      fourth_prize: string;
      fifth_prize: string;
      complementary_prizes: string[];
    }) => {
      try {
        const res = await api.patch(`/draw-result/result/${id}/`, rest);
        return res?.data;
      } catch (error: any) {
        console.log("Error updating draw result:", error);
        // Optionally, you can throw a more descriptive error
        throw error?.message?.detail || error?.message || "Failed to update draw result.";
      }
    },
    onError: (error) => {
      console.log("errror", error);

      // You can handle side effects here, e.g., show a toast or log
      // console.log("Mutation error in updateDrawResult:", error);
    },
  });


  // Always return all mutation objects, never undefined
  return {
    createDraw: createDraw,
    updateDraw: updateDraw,
    createDrawResult: createDrawResult,
    updateDrawResult: updateDrawResult,
    updateDrawResultIsPending: updateDrawResult.isPending,
    createDrawResultIsPending: createDrawResult.isPending
  };
};

export default useDraw;
