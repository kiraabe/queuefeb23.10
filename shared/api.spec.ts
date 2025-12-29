import { describe, expect, it } from "vitest";
import { formatTicketCode } from "./api";

describe("formatTicketCode", () => {
  it("pads numbers to 3 digits and wraps to 001-200", () => {
    expect(formatTicketCode("S1", 5)).toBe("005");
    expect(formatTicketCode("S2", 42)).toBe("042");
    expect(formatTicketCode("S3", 123)).toBe("123");
    // wrap beyond 200
    expect(formatTicketCode("S1", 201)).toBe("001");
  });
});
