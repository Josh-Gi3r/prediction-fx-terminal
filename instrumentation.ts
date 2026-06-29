export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkRequiredEnv } = await import("@/lib/api/requireEnv");
    checkRequiredEnv();
  }
}
