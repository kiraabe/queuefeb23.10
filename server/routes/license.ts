import { RequestHandler } from "express";
import { ValidateLicenseRequest, ValidateLicenseResponse } from "@shared/api";
import { validateLicense } from "../services/license-service";

export const validateLicenseHandler: RequestHandler = async (req, res) => {
  try {
    const { licenseKey, machineId } = req.body as ValidateLicenseRequest;

    if (!licenseKey || typeof licenseKey !== "string") {
      return res.status(400).json({
        valid: false,
        message: "Missing or invalid license key",
      });
    }

    if (!machineId || typeof machineId !== "string") {
      return res.status(400).json({
        valid: false,
        message: "Machine identity verification failed. Please try again or clear your browser data.",
      });
    }

    const result = await validateLicense(licenseKey, machineId);
    const response: ValidateLicenseResponse = {
      valid: result.valid,
      message: result.message,
      licensee: result.valid ? result.licensee : undefined,
    };

    res.json(response);
  } catch (error) {
    console.error("[License] Validation error:", error);
    res.status(500).json({
      valid: false,
      message: "License validation failed",
    });
  }
};
