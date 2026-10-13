import { serviceImageResponse } from "../utils/serviceImageResponse";
import { OrderAssignment } from "../models/orderAssignment.model";

export const getAssignmentRealtimePayload = async (assignmentId: string) => {
  return OrderAssignment.findById(assignmentId)
    .populate({
      path: "orderId",
      select: [
        "orderCode",
        "serviceId",
        "addressId",
        "orderType",
        "scheduledAt",
        "recurringGroupId",
        "recurrenceUnit",
        "occurrenceNumber",
        "totalOccurrences",
        "pricing",
        "inspectionRequired",
        "createdAt",
      ].join(" "),
      populate: [
        {
          path: "serviceId",
          select: "name image coverImage serviceType depositAmount fixedPrice", transform: serviceImageResponse,
        },
        { path: "addressId", select: "ward province" },
      ],
    })
    .lean();
};
