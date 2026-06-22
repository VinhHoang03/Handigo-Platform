import { OrderAssignment } from "../models/orderAssignment.model";

export const getAssignmentRealtimePayload = async (assignmentId: string) => {
  return OrderAssignment.findById(assignmentId)
    .populate({
      path: "orderId",
      populate: [
        { path: "customerId", select: "fullName avatar phone" },
        {
          path: "serviceId",
          select: "name image serviceType depositAmount fixedPrice",
        },
        { path: "addressId" },
      ],
    })
    .lean();
};
