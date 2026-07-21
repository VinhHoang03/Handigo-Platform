import { Request, Response, NextFunction } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import type { UserRole } from "../models/user.model";
import { AssignmentService } from "../services/assignment.service";
import { DispatchService } from "../services/dispatch.service";
import { OrderService } from "../services/order.service";
import { AppError } from "../utils/appError";
import { respondToProviderReassignment } from "../services/orderReassignment.service";

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

const uid = (req: Request): string => requireRequestUser(req).id;

const toOrderActorRole = (role: UserRole): "customer" | "provider" | "admin" =>
  role.toLowerCase() as "customer" | "provider" | "admin";

const toQuotationViewerRole = (role: UserRole): "CUSTOMER" | "PROVIDER" => {
  if (role === "ADMIN") {
    throw new AppError("Bạn không có quyền xem báo giá của đơn hàng này.", 403);
  }

  return role;
};

const param = (req: Request, name: string): string => {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : String(value || "");
};

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const order = await OrderService.createOrder({
      customerId: uid(req),
      ...req.body,
    });
    return ok(res, order, 201);
  } catch (error) {
    return next(error);
  }
};

export const getMyOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const result = await OrderService.getOrdersByCustomer(
      uid(req),
      page,
      limit,
      { status, search },
    );
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
};

export const getProviderRecentOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const limit = Number(req.query.limit) || 5;
    const result = await OrderService.getRecentOrdersByProvider(uid(req), limit);
    return ok(res, { items: result });
  } catch (error) {
    return next(error);
  }
};

export const getProviderOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const result = await OrderService.getOrdersByProvider(uid(req), page, limit, {
      status,
      search,
    });
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
};

export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const order = await OrderService.getOrderById(param(req, "orderId"), uid(req));
    return ok(res, order);
  } catch (error) {
    return next(error);
  }
};

export const getRecurringSeries = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orders = await OrderService.getRecurringSeries(
      param(req, "orderId"),
      uid(req),
    );
    return ok(res, { items: orders });
  } catch (error) {
    return next(error);
  }
};

export const discardUnpaidOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await OrderService.discardUnpaidOrder(
      param(req, "orderId"),
      uid(req),
    );
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
};

export const selectAppointmentProvider = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const order = await OrderService.selectAppointmentProvider(
      param(req, "orderId"),
      uid(req),
      String(req.body.providerId || ""),
    );
    return ok(res, order);
  } catch (error) {
    return next(error);
  }
};

export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const role = toOrderActorRole(requireRequestUser(req).role);
    const { reason } = req.body;

    if (!reason) {
      throw new AppError("Vui lòng cung cấp lý do hủy.", 400);
    }

    const order = await OrderService.cancelOrder(
      param(req, "orderId"),
      uid(req),
      role,
      reason,
    );
    return ok(res, order);
  } catch (error) {
    return next(error);
  }
};

export const respondToReassignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const order = await respondToProviderReassignment(
      param(req, "orderId"),
      uid(req),
      req.body.decision,
    );
    return ok(res, order);
  } catch (error) {
    return next(error);
  }
};

export const previewCancellation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const role = toOrderActorRole(requireRequestUser(req).role);
    const scope = req.query.scope === "series" ? "series" : "single";
    const preview = await OrderService.previewCancellation(
      param(req, "orderId"),
      uid(req),
      role,
      scope,
    );
    return ok(res, preview);
  } catch (error) {
    return next(error);
  }
};

export const cancelRecurringSeries = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { reason } = req.body;
    const result = await OrderService.cancelRecurringSeries(
      param(req, "orderId"),
      uid(req),
      reason,
    );
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
};

export const startOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const order = await OrderService.startOrder(param(req, "orderId"), uid(req));
    return ok(res, order);
  } catch (error) {
    return next(error);
  }
};

export const completeOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { completionEvidenceImages, completionNote } = req.body;
    const evidenceImages = Array.isArray(completionEvidenceImages)
      ? completionEvidenceImages.filter(
          (url): url is string => typeof url === "string",
        )
      : [];
    const order = await OrderService.completeOrder(
      param(req, "orderId"),
      uid(req),
      evidenceImages,
      typeof completionNote === "string" ? completionNote : undefined,
    );
    return ok(res, order);
  } catch (error) {
    return next(error);
  }
};

export const acceptAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await AssignmentService.acceptAssignment(
      param(req, "assignmentId"),
      uid(req),
    );
    return ok(res, result);
  } catch (error) {
    return next(error);
  }
};

export const rejectAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { rejectReason } = req.body;
    await AssignmentService.rejectAssignment(
      param(req, "assignmentId"),
      uid(req),
      rejectReason,
    );
    return ok(res, {
      message: "Đã từ chối yêu cầu nhận đơn.",
    });
  } catch (error) {
    return next(error);
  }
};

export const getPendingAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await AssignmentService.getPendingAssignmentForProvider(uid(req));
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

export const getOrderAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const actor = requireRequestUser(req);
    const data = await AssignmentService.getAssignmentsByOrder(
      param(req, "orderId"),
      actor.id,
      actor.role,
    );
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

export const redispatchOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await DispatchService.redispatch(param(req, "orderId"));
    return ok(res, { message: "Re-dispatch thành công." });
  } catch (error) {
    return next(error);
  }
};

export const createRepairQuotation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    const providerUserId = uid(req);
    const quotation = await AssignmentService.createRepairQuotation(
      { ...req.body, orderId },
      providerUserId,
    );
    return ok(res, quotation, 201);
  } catch (error) {
    return next(error);
  }
};

export const getRepairQuotation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = requireRequestUser(req);
    const data = await AssignmentService.getQuotationByOrder(
      param(req, "orderId"),
      user.id,
      toQuotationViewerRole(user.role),
    );
    return ok(res, data);
  } catch (error) {
    return next(error);
  }
};

export const confirmRepairQuotation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quotation = await AssignmentService.confirmRepairQuotation(
      param(req, "quotationId"),
      uid(req),
    );
    return ok(res, quotation);
  } catch (error) {
    return next(error);
  }
};

export const rejectRepairQuotation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { rejectionReason } = req.body;
    const quotation = await AssignmentService.rejectRepairQuotation(
      param(req, "quotationId"),
      uid(req),
      rejectionReason,
    );
    return ok(res, quotation);
  } catch (error) {
    return next(error);
  }
};

export const uploadOrderAttachment = async (_req: Request, res: Response) => {
  return ok(res, { url: res.locals.imageUrl }, 201);
};
