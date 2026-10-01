import appHandler from "./_server.ts";

export default async function handler(req: any, res: any) {
  try {
    return await appHandler(req, res);
  } catch (err: any) {
    console.error("[Vercel Serverless Function Error]", err);
    if (res && !res.headersSent) {
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json({
        error: "Serverless execution recovered",
        message: err.message || String(err),
      });
    }
  }
}
