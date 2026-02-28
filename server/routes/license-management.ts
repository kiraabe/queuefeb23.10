import { RequestHandler } from "express";
import { ValidateLicenseResponse } from "@shared/api";
import {
  createLicenseDb,
  listLicensesDb,
  updateLicenseStatusDb,
  deleteLicenseDb,
  LicenseRecord,
} from "../store/db";
import { v4 as uuidv4 } from "uuid";

interface CreateLicenseRequest {
  licenseKey: string;
  licensee: string;
  expiresAt?: number; // Unix timestamp in ms
  notes?: string;
}

interface CreateLicenseResponse {
  success: boolean;
  message: string;
  license?: LicenseRecord;
}

interface ListLicensesResponse {
  licenses: LicenseRecord[];
}

interface UpdateLicenseStatusRequest {
  status: "active" | "inactive" | "expired" | "revoked";
}

interface UpdateLicenseStatusResponse {
  success: boolean;
  message: string;
  license?: LicenseRecord;
}

interface DeleteLicenseResponse {
  success: boolean;
  message: string;
}

/**
 * Create a new license
 */
export const createLicenseHandler: RequestHandler = async (req, res) => {
  try {
    const { licenseKey, licensee, expiresAt, notes } = req.body as CreateLicenseRequest;

    // Validation
    if (!licenseKey || !licensee) {
      return res.status(400).json({
        success: false,
        message: "License key and licensee name are required",
      });
    }

    if (licenseKey.length < 8) {
      return res.status(400).json({
        success: false,
        message: "License key must be at least 8 characters long",
      });
    }

    // Get user ID from auth context (assuming it's set by middleware)
    const userId = (req as any).userId || null;

    const license = await createLicenseDb(
      licenseKey,
      licensee,
      userId,
      expiresAt || null,
      notes || null,
    );

    const response: CreateLicenseResponse = {
      success: true,
      message: `License created for ${licensee}`,
      license,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("[License Management] Create error:", error);

    // Check for duplicate key error
    if (error instanceof Error && error.message.includes("duplicate")) {
      return res.status(409).json({
        success: false,
        message: "License key already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create license",
    });
  }
};

/**
 * List all licenses
 */
export const listLicensesHandler: RequestHandler = async (req, res) => {
  try {
    const licenses = await listLicensesDb();

    const response: ListLicensesResponse = {
      licenses,
    };

    res.json(response);
  } catch (error) {
    console.error("[License Management] List error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list licenses",
    });
  }
};

/**
 * Update license status
 */
export const updateLicenseStatusHandler: RequestHandler = async (req, res) => {
  try {
    const { licenseKey } = req.params;
    const { status } = req.body as UpdateLicenseStatusRequest;

    // Validation
    const validStatuses = ["active", "inactive", "expired", "revoked"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const license = await updateLicenseStatusDb(
      licenseKey,
      status as "active" | "inactive" | "expired" | "revoked",
    );

    if (!license) {
      return res.status(404).json({
        success: false,
        message: "License not found",
      });
    }

    const response: UpdateLicenseStatusResponse = {
      success: true,
      message: `License status updated to ${status}`,
      license,
    };

    res.json(response);
  } catch (error) {
    console.error("[License Management] Update error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update license",
    });
  }
};

/**
 * Delete a license
 */
export const deleteLicenseHandler: RequestHandler = async (req, res) => {
  try {
    const { licenseKey } = req.params;

    const deleted = await deleteLicenseDb(licenseKey);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "License not found",
      });
    }

    const response: DeleteLicenseResponse = {
      success: true,
      message: "License deleted successfully",
    };

    res.json(response);
  } catch (error) {
    console.error("[License Management] Delete error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete license",
    });
  }
};
