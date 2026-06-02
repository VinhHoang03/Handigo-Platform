import { Response, Request } from "express";
import * as addressService from "../services/address.service";

export const createAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = (req as any).user.id;
    const address = await addressService.createAddress(userId, req.body);

    return res.json({
      success: true,
      data: address,
      message: "Address created successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = (req as any).user.id;
    const { id } = req.params;

    const address = await addressService.updateAddress(id as string, userId, req.body);

    return res.json({
      success: true,
      data: address,
      message: "Address updated successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = (req as any).user.id;
    const { id } = req.params;

    await addressService.deleteAddress(id as string, userId);

    return res.json({
      success: true,
      data: null,
      message: "Address deleted successfully",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserAddresses = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = (req as any).user.id;
    const addresses = await addressService.getUserAddresses(userId);

    return res.json({
      success: true,
      data: addresses,
      message: "Success",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const setDefaultAddress = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const userId = (req as any).user.id;
    const { id } = req.params;

    const address = await addressService.setDefaultAddress(userId, id as string);

    return res.json({
      success: true,
      data: address,
      message: "Default address updated",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getServiceHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const history = await addressService.getServiceHistory(userId as string);

    return res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};