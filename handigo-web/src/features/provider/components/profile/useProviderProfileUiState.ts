import { useState, type RefObject } from "react";
import type { ProviderApplication } from "@/features/provider-application/types/providerApplication.types";
import type { ProviderProfileResponse } from "../../types/provider.types";

type UseProviderProfileUiStateParams = {
  profile: ProviderProfileResponse | null;
  userProfileSectionRef: RefObject<HTMLDivElement | null>;
};

/**
 * Small UI-only state that doesn't belong to a single data flow: the phone
 * verification scroll/highlight nudge, and the service-addition application
 * dialog toggling.
 */
export function useProviderProfileUiState({
  profile,
  userProfileSectionRef,
}: UseProviderProfileUiStateParams) {
  const [phoneHighlighted, setPhoneHighlighted] = useState(false);
  const [isServiceApplicationOpen, setIsServiceApplicationOpen] =
    useState(false);
  const [editingServiceApplication, setEditingServiceApplication] =
    useState<ProviderApplication | null>(null);
  const [applicationHistoryKey, setApplicationHistoryKey] = useState(0);

  function handlePhoneVerificationClick() {
    if (profile?.user.phone) return;

    userProfileSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setPhoneHighlighted(true);
    window.setTimeout(() => setPhoneHighlighted(false), 2600);
  }

  function openServiceApplication(application?: ProviderApplication) {
    setEditingServiceApplication(application || null);
    setIsServiceApplicationOpen(true);
  }

  function closeServiceApplication() {
    setIsServiceApplicationOpen(false);
    setEditingServiceApplication(null);
  }

  function bumpApplicationHistoryKey() {
    setApplicationHistoryKey((current) => current + 1);
  }

  return {
    phoneHighlighted,
    handlePhoneVerificationClick,
    isServiceApplicationOpen,
    editingServiceApplication,
    applicationHistoryKey,
    openServiceApplication,
    closeServiceApplication,
    bumpApplicationHistoryKey,
  };
}
