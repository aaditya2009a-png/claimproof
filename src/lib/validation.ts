import { z } from "zod";

export const SOURCE_TYPES = ["fact", "terminology", "tone", "disclosure"] as const;
export const LIMITS = { sourceTitle: 200, sourceContent: 5000, draftTitle: 200, draftContent: 20000 } as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((d) => !Number.isNaN(Date.parse(d)), "Use a valid date.");

export const sourceSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(LIMITS.sourceTitle, "Title is too long."),
    content: z
      .string()
      .trim()
      .min(10, "Content must be at least 10 characters.")
      .max(LIMITS.sourceContent, `Content must be at most ${LIMITS.sourceContent} characters.`),
    type: z.enum(SOURCE_TYPES),
    approved: z.boolean(),
    effective_date: isoDate,
    expiry_date: isoDate.nullable(),
  })
  .refine((d) => d.expiry_date === null || d.expiry_date >= d.effective_date, {
    message: "Expiry date must be on or after the effective date.",
    path: ["expiry_date"],
  });

export const submissionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(LIMITS.draftTitle, "Title is too long."),
  content: z
    .string()
    .trim()
    .min(10, "Draft must be at least 10 characters.")
    .max(LIMITS.draftContent, `Draft must be at most ${LIMITS.draftContent} characters.`),
});

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

export function parseSourceForm(fd: FormData) {
  return sourceSchema.safeParse({
    id: str(fd, "id") || undefined,
    title: str(fd, "title"),
    content: str(fd, "content"),
    type: str(fd, "type"),
    approved: fd.get("approved") === "on",
    effective_date: str(fd, "effective_date"),
    expiry_date: str(fd, "expiry_date") || null,
  });
}

export function parseSubmissionForm(fd: FormData) {
  return submissionSchema.safeParse({
    id: str(fd, "id") || undefined,
    title: str(fd, "title"),
    content: str(fd, "content"),
  });
}
