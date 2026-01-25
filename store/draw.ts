import { create } from "zustand";

interface Draw {
  id: number;
  name: string;
  valid_from: string;
  valid_till: string;
  cut_off_time: string;
  draw_time: string;
  color_theme: string;
  non_single_digit_price: number;
  single_digit_number_price: number;
}

interface DrawState {
  selectedDraw: Draw | null;
  setSelectedDraw: (selectedDraw: Draw | null) => void;
}

const useDrawStore = create<DrawState>((set) => ({
  selectedDraw: null,
  setSelectedDraw: (draw) => set({ selectedDraw: draw }),
}));

export default useDrawStore;
