import { useState, type Dispatch, type SetStateAction } from "react";
import { getErrorMessage } from "@/utils/apiError";
import { providerProfileApi } from "../../api/providerProfile.api";
import type { ProviderProfileResponse } from "../../types/provider.types";

type UseProviderServiceAreaFlowParams = {
  profile: ProviderProfileResponse | null;
  setProfile: Dispatch<SetStateAction<ProviderProfileResponse | null>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
};

/** Working-area (service area) edit modal: open, edit list, save. */
export function useProviderServiceAreaFlow({
  profile,
  setProfile,
  setIsSaving,
}: UseProviderServiceAreaFlowParams) {
  const [isServiceAreaModalOpen, setIsServiceAreaModalOpen] = useState(false);
  const [workingAreasForm, setWorkingAreasForm] = useState<string[]>([]);
  const [serviceAreaError, setServiceAreaError] = useState("");

  function openServiceAreaEdit() {
    if (!profile) return;
    const legacyArea = [
      profile.provider.serviceArea?.ward,
      profile.provider.serviceArea?.province,
    ]
      .filter(Boolean)
      .join(", ");
    setWorkingAreasForm(
      profile.provider.workingAreas?.length
        ? profile.provider.workingAreas
        : legacyArea
          ? [legacyArea]
          : [],
    );
    setServiceAreaError("");
    setIsServiceAreaModalOpen(true);
  }

  async function handleServiceAreaSave() {
    const [firstArea = ""] = workingAreasForm;
    const parts = firstArea
      .split(", ")
      .map((item) => item.trim())
      .filter(Boolean);
    setIsSaving(true);
    setServiceAreaError("");
    try {
      const nextProfile = await providerProfileApi.updateProfile({
        workingAreas: workingAreasForm,
        serviceArea: {
          ward: parts[0],
          province: parts.slice(1).join(", ") || undefined,
        },
      });
      setProfile(nextProfile);
      setIsServiceAreaModalOpen(false);
    } catch (saveError) {
      setServiceAreaError(
        getErrorMessage(saveError, "Không thể cập nhật khu vực phục vụ."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return {
    isServiceAreaModalOpen,
    setIsServiceAreaModalOpen,
    workingAreasForm,
    setWorkingAreasForm,
    serviceAreaError,
    openServiceAreaEdit,
    handleServiceAreaSave,
  };
}
