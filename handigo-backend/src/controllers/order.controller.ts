import { Request, Response, NextFunction } from "express";
import { OrderService } from "../services/order.service";
import { AssignmentService } from "../services/assignment.service";
import { DispatchService } from "../services/dispatch.service";
import { AppError } from "../utils/appError";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

/** Safely get userId as guaranteed string from JWT payload */
const uid = (req: Request): string => {
  const u = req.user as any;
  return String(u?.id || u?._id || "");
};

/** Safely get a param as string */
const param = (req: Request, name: string): string => {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : String(val || "");
};

// ─── Order CRUD ───────────────────────────────────────────────────────────────

/**
 * POST /orders
 */
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customerId = uid(req);
    const order = await OrderService.createOrder({
      customerId,
      ...req.body,
    });
    return ok(res, order, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /orders
 */
export const getMyOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customerId = uid(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const result = await OrderService.getOrdersByCustomer(customerId, page, limit, { status, search });
    return ok(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /orders/provider/recent
 */
export const getProviderRecentOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const limit = Number(req.query.limit) || 5;
    const result = await OrderService.getRecentOrdersByProvider(uid(req), limit);
    return ok(res, { items: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /orders/provider
 */
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
  } catch (err) {
    next(err);
  }
};

/**
 * GET /orders/:orderId
 */
export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    const order = await OrderService.getOrderById(orderId, uid(req));
    return ok(res, order);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /orders/:orderId/cancel
 */
export const cancelOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    const u = req.user as any;
    const role = String(u?.role || "customer").toLowerCase() as
      | "customer"
      | "provider"
      | "admin";
    const { reason } = req.body;
    if (!reason) throw new AppError("Vui lòng cung cấp lý do hủy.", 400);
    const order = await OrderService.cancelOrder(orderId, uid(req), role, reason);
    return ok(res, order);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /orders/:orderId/start
 */
export const startOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    const order = await OrderService.startOrder(orderId, uid(req));
    return ok(res, order);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /orders/:orderId/complete
 */
export const completeOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    const { completionEvidenceImages, completionNote } = req.body;
    const evidenceImages = Array.isArray(completionEvidenceImages)
      ? completionEvidenceImages.filter(
          (url): url is string => typeof url === "string",
        )
      : [];
    const order = await OrderService.completeOrder(
      orderId,
      uid(req),
      evidenceImages,
      typeof completionNote === "string" ? completionNote : undefined,
    );
    return ok(res, order);
  } catch (err) {
    next(err);
  }
};

// ─── Assignment ────────────────────────────────────────────────────────────────

/**
 * POST /orders/assignments/:assignmentId/accept
 */
export const acceptAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const assignmentId = param(req, "assignmentId");
    const result = await AssignmentService.acceptAssignment(
      assignmentId,
      uid(req),
    );
    return ok(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /orders/assignments/:assignmentId/reject
 */
export const rejectAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const assignmentId = param(req, "assignmentId");
    const { rejectReason } = req.body;
    await AssignmentService.rejectAssignment(
      assignmentId,
      uid(req),
      rejectReason,
    );
    return ok(res, { message: "Đã từ chối đơn hàng và chuyển sang provider tiếp theo." });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /orders/assignments/pending
 */
export const getPendingAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await AssignmentService.getPendingAssignmentForProvider(uid(req));
    return ok(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /orders/:orderId/assignments
 */
export const getOrderAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    const data = await AssignmentService.getAssignmentsByOrder(orderId);
    return ok(res, data);
  } catch (err) {
    next(err);
  }
};

// ─── Dispatch ────────────────────────────────────────────────────────────────

/**
 * POST /orders/:orderId/redispatch
 */
export const redispatchOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    await DispatchService.redispatch(orderId);
    return ok(res, { message: "Re-dispatch thành công." });
  } catch (err) {
    next(err);
  }
};

// ─── Repair Quotation ────────────────────────────────────────────────────────

/**
 * POST /orders/:orderId/quotations
 */
export const createRepairQuotation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    const providerUserId = uid(req);
    const quotation = await AssignmentService.createRepairQuotation(
      { orderId, providerId: providerUserId, ...req.body },
      providerUserId,
    );
    return ok(res, quotation, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /orders/:orderId/quotation
 */
export const getRepairQuotation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orderId = param(req, "orderId");
    const u = req.user as any;
    const role = String(u?.role || "").toUpperCase() as "CUSTOMER" | "PROVIDER";
    const data = await AssignmentService.getQuotationByOrder(orderId, uid(req), role);
    return ok(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /orders/quotations/:quotationId/confirm
 */
export const confirmRepairQuotation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quotationId = param(req, "quotationId");
    const quotation = await AssignmentService.confirmRepairQuotation(
      quotationId,
      uid(req),
    );
    return ok(res, quotation);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /orders/quotations/:quotationId/reject
 */
export const rejectRepairQuotation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const quotationId = param(req, "quotationId");
    const { rejectionReason } = req.body;
    const quotation = await AssignmentService.rejectRepairQuotation(
      quotationId,
      uid(req),
      rejectionReason,
    );
    return ok(res, quotation);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /orders/attachments
 */
export const uploadOrderAttachment = async (_req: Request, res: Response) => {
  return ok(res, { url: res.locals.imageUrl }, 201);
};
