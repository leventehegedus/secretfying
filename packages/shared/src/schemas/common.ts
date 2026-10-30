import { z } from "zod";

export const Iata = z.string().regex(/^[A-Z]{3}$/);
export type Iata = z.infer<typeof Iata>;

export const Destination = z.union([Iata, z.literal("ANYWHERE")]);
export type Destination = z.infer<typeof Destination>;

// Regex alone accepts 2026-02-30; the round trip rejects dates that roll over.
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "not a real date");
export type IsoDate = z.infer<typeof IsoDate>;

export const IsoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

export const Currency = z.literal("EUR");
export type Currency = z.infer<typeof Currency>;

export const ProviderId = z.enum(["travelpayouts", "serpapi", "fixture"]);
export type ProviderId = z.infer<typeof ProviderId>;

export const TripType = z.enum(["oneway", "return"]);
export type TripType = z.infer<typeof TripType>;
