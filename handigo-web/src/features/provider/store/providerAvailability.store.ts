import { create } from "zustand";
import type { ProviderAvailabilityStatus } from "../api/providerDashboard.api";

type InitializationStatus = "idle" | "loading" | "ready";

interface ProviderAvailabilityState {
  providerUserId: string | null;
  availabilityStatus: ProviderAvailabilityStatus;
  initializationStatus: InitializationStatus;
  isUpdating: boolean;
  startInitialization: (providerUserId: string) => boolean;
  completeInitialization: (
    providerUserId: string,
    availabilityStatus: ProviderAvailabilityStatus,
  ) => void;
  setAvailabilityStatus: (
    availabilityStatus: ProviderAvailabilityStatus,
  ) => void;
  setIsUpdating: (isUpdating: boolean) => void;
}

export const useProviderAvailabilityStore =
  create<ProviderAvailabilityState>((set, get) => ({
    providerUserId: null,
    availabilityStatus: "offline",
    initializationStatus: "idle",
    isUpdating: false,
    startInitialization: (providerUserId) => {
      const state = get();
      if (
        state.providerUserId === providerUserId &&
        state.initializationStatus !== "idle"
      ) {
        return false;
      }

      set({
        providerUserId,
        availabilityStatus: "offline",
        initializationStatus: "loading",
        isUpdating: false,
      });
      return true;
    },
    completeInitialization: (providerUserId, availabilityStatus) => {
      if (get().providerUserId !== providerUserId) return;
      set({ availabilityStatus, initializationStatus: "ready" });
    },
    setAvailabilityStatus: (availabilityStatus) =>
      set({ availabilityStatus }),
    setIsUpdating: (isUpdating) => set({ isUpdating }),
  }));
