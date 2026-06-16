import { NextFunction, Request, Response } from "express";
import * as vietnamAddressService from "../services/vietnamAddress.service";

const parseCodeParam = (value: string | string[] | undefined, name: string): number => {
  if (Array.isArray(value)) {
    const error = new Error(`${name} must be a single value`) as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  const code = Number(value);
  if (!Number.isInteger(code) || code <= 0) {
    const error = new Error(`${name} must be a positive integer`) as Error & {
      statusCode?: number;
    };
    error.statusCode = 400;
    throw error;
  }

  return code;
};

export const getProvinces = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await vietnamAddressService.getProvinces();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getWardsByProvince = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const provinceCode = parseCodeParam(req.params.provinceCode, "provinceCode");
    const data = await vietnamAddressService.getWardsByProvince(provinceCode);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
