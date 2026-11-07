import { describe, it, expect } from "vitest";
import { sourceSchema, submissionSchema } from "@/lib/validation";
import { sourceStatus } from "@/lib/source-status";

const base = {
  title: "Customer count",
  content: "PayNest serves 12,400 customers.",
  type: "fact" as const,
  approved: true,
  effective_date: "2026-10-01",
  expiry_date: null,
};

describe("sourceSchema", () => {
  it("accepts a valid source", () => {
    expect(sourceSchema.safeParse(base).success).toBe(true);
  });
  it("rejects an unknown type", () => {
    expect(sourceSchema.safeParse({ ...base, type: "rumour" }).success).toBe(false);
  });
  it("rejects expiry before effective date", () => {
    expect(sourceSchema.safeParse({ ...base, expiry_date: "2026-01-01" }).success).toBe(false);
  });
  it("rejects invalid dates", () => {
    expect(sourceSchema.safeParse({ ...base, effective_date: "2026-13-45" }).success).toBe(false);
  });
  it("rejects over-long content", () => {
    expect(sourceSchema.safeParse({ ...base, content: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("submissionSchema", () => {
  it("accepts a valid draft", () => {
    expect(submissionSchema.safeParse({ title: "Launch post", content: "A short draft of text." }).success).toBe(true);
  });
  it("rejects drafts over the limit", () => {
    expect(submissionSchema.safeParse({ title: "Launch post", content: "x".repeat(20001) }).success).toBe(false);
  });
});

describe("sourceStatus", () => {
  it("marks past-expiry sources as expired", () => {
    expect(sourceStatus({ effective_date: "2023-01-01", expiry_date: "2024-01-01" }, "2026-11-06")).toBe("expired");
  });
  it("treats the expiry day itself as still active", () => {
    expect(sourceStatus({ effective_date: "2023-01-01", expiry_date: "2026-11-06" }, "2026-11-06")).toBe("active");
  });
  it("marks future sources as not yet effective", () => {
    expect(sourceStatus({ effective_date: "2027-01-01", expiry_date: null }, "2026-11-06")).toBe("not_yet_effective");
  });
});
