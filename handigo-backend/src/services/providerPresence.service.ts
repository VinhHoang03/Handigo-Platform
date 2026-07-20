import { Provider } from "../models/provider.model";

export const markProviderOffline = async (userId: string) => {
  await Provider.updateOne(
    { userId, isDeleted: false },
    { $set: { availabilityStatus: "offline" } },
  );
};
