import { serviceImageResponse } from "../utils/serviceImageResponse";
import { OrderAssignment } from "../models/orderAssignment.model";
import { withAssignmentArea } from "../utils/orderAddress";

export const getAssignmentRealtimePayload = async (assignmentId: string) => {
  return OrderAssignment.findById(assignmentId)
    .populate({
      path: "orderId",
      select: [
        "orderCode",
        "serviceId",
        "addressId",
        "addressSnapshot",
        "orderType",
        "scheduledAt",
        "pricing",
        "inspectionRequired",
        "createdAt",
      ].join(" "),
      populate: [
        {
          path: "serviceId",
          select: "name image coverImage serviceType depositAmount fixedPrice", transform: serviceImageResponse,
        },
        { path: "addressId", select: "fullAddress ward province" },
      ],
      transform: withAssignmentArea,
    })
    .lean();
};
