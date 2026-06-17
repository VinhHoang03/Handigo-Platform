import { NextFunction, Request, Response } from "express";
import * as serviceService from "../services/service.service";
import * as serviceOptionService from "../services/serviceOption.service";

export const listServices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await serviceService.listServices(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getServiceById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await serviceService.getServiceById(req.params.id as string);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getServiceOptions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await serviceOptionService.getOptionsByServiceId(
      req.params.id as string,
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await serviceService.createService(req.body);
    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const updateService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await serviceService.updateService(
      req.params.id as string,
      req.body,
    );
    return res.json({
      success: true,
      message: "Service updated successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await serviceService.deleteService(req.params.id as string);
    return res.json({
      success: true,
      message: "Service deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
