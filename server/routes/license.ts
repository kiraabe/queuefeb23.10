import { RequestHandler } from "express";
import { ValidateLicenseRequest, ValidateLicenseResponse } from "@shared/api";
import { validateLicense } from "../services/license-service";

export const validateLicenseHandler: RequestHandler = async (req, res) => {
  try {
    const { licenseKey } = req.body as ValidateLicenseRequest;

    // Get the proper host from forwarded headers (production) or direct headers (dev)
    // X-Forwarded-Host is set by proxies/load balancers in production
    const forwardedHost = req.headers['x-forwarded-host'] as string || req.headers.host || "localhost";
    // Extract just the hostname without port for consistent binding
    const host = forwardedHost.split(':')[0];

    if (!licenseKey || typeof licenseKey !== "string") {
      return res.status(400).json({
        valid: false,
        message: "Enter your license key to activate the application.",
        errorCode: "LICENSE_NOT_PROVIDED",
      });
    }

    const result = await validateLicense(host, licenseKey);
    const response: ValidateLicenseResponse = {
      valid: result.valid,
      message: result.message,
      errorCode: result.errorCode,
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
    // Get the proper host from forwarded headers (production) or direct headers (dev)
    // X-Forwarded-Host is set by proxies/load balancers in production
    const forwardedHost = req.headers['x-forwarded-host'] as string || req.headers.host || "localhost";
    // Extract just the hostname without port for consistent binding
    const host = forwardedHost.split(':')[0];

    const result = await validateLicense(host);
    const response: ValidateLicenseResponse = {
      valid: result.valid,
      message: result.message,
      errorCode: result.errorCode,
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
