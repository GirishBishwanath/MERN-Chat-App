export const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:4002";
export const SEED_EMAIL = __ENV.K6_SEED_EMAIL || "phase18-benchmark-alice@example.com";
export const SEED_PASSWORD = __ENV.K6_SEED_PASSWORD || "Phase18BenchmarkPassword!123";
export const RECEIVER_ID = __ENV.K6_RECEIVER_ID || "";
export const SEED_DATASET_ID = __ENV.K6_SEED_DATASET_ID || "default";
export const TEST_ORIGIN = __ENV.K6_ORIGIN || "http://localhost:3001";

export function requireReceiverId() {
  if (!RECEIVER_ID) {
    throw new Error("K6_RECEIVER_ID must be set to the synthetic receiver UUID produced by the seed script");
  }
  return RECEIVER_ID;
}
