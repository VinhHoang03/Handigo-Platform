import { NextFunction, Request, Response } from "express";
import * as providerProfileService from "../services/providerProfile.service";
import { AppError } from "../utils/appError";
import {
  createCertificateSchema,
  submitIdentitySchema,
  updateCertificateSchema,
  updateProviderProfileSchema,
} from "../validations/providerProfile.validator";

const getUserId = (req: Request) => {
  if (!req.user?.id) {
    throw new AppError("Authentication is required", 401);
  }

  return req.user.id;
};

export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await providerProfileService.getMyProviderProfile(getUserId(req));
    return res.json({
      success: true,
      data,
      message: "Get provider profile successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = updateProviderProfileSchema.parse(req.body);
    const data = await providerProfileService.updateMyProviderProfile(
      getUserId(req),
      payload,
    );

    return res.json({
      success: true,
      data,
      message: "Provider profile updated successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const submitIdentity = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = submitIdentitySchema.parse(req.body);
    const data = await providerProfileService.submitMyIdentityDocument(
      getUserId(req),
      payload,
    );

    return res.status(201).json({
      success: true,
      data,
      message: "Identity document submitted successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const createCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = createCertificateSchema.parse(req.body);
    const data = await providerProfileService.createMyCertificate(
      getUserId(req),
      payload,
    );

    return res.status(201).json({
      success: true,
      data,
      message: "Certificate created successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = updateCertificateSchema.parse(req.body);
    const data = await providerProfileService.updateMyCertificate(
      getUserId(req),
      String(req.params.certificateId),
      payload,
    );

    return res.json({
      success: true,
      data,
      message: "Certificate updated successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await providerProfileService.deleteMyCertificate(
      getUserId(req),
      String(req.params.certificateId),
    );

    return res.json({
      success: true,
      data,
      message: "Certificate deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};
