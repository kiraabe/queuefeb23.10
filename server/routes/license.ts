import { RequestHandler } from "express";
import { ValidateLicenseRequest, ValidateLicenseResponse } from "@shared/api";
import { validateLicense } from "../services/license-service";

export const validateLicenseHandler: RequestHandler = async (req, res) => {
  try {
    const { licenseKey } = req.body as ValidateLicenseRequest;
    const host = req.headers.host || "localhost";

    if (!licenseKey || typeof licenseKey !== "string") {
      return res.status(400).json({
        valid: false,
        message: "Missing or invalid license key",
      });
    }

    const result = await validateLicense(host, licenseKey);
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

export const checkLicenseStatusHandler: RequestHandler = async (req, res) => {
  try {
    const host = req.headers.host || "localhost";
    const result = await validateLicense(host);
    const response: ValidateLicenseResponse = {
      valid: result.valid,
      message: result.message,
      licensee: result.valid ? result.licensee : undefined,
    };

    res.json(response);
  } catch (error) {
    console.error("[License] Status check error:", error);
    res.status(500).json({
      valid: false,
      message: "License status check failed",
    });
  }
};
