import appPromise from "../server";

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel Serverless Handler Error]:", err);
    if (!res.headersSent) {
      res.status(200).json({
        error: err?.message || "Internal Server Error",
        videos: [],
        results: [],
        success: false,
      });
    }
  }
}

