import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../types/express.d";

export const isLoggedIn = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Dev bypass — only active when NODE_ENV=development, never in staging/production
  if (
    process.env.NODE_ENV === "development" &&
    process.env.IS_AUTHENTICATED === "true"
  ) {
    req.user = {
      id: process.env.DEV_USER_ID || "dev-user-id",
      email: process.env.DEV_USER_EMAIL || "dev@dblue.it",
    };
    return next();
  }

  try {
    let token: string | undefined = undefined;
    const webtoken = req.cookies.token as string | undefined;
    const apitoken = req.header("Authorization")?.replace("Bearer ", "");

    if (webtoken) {
      token = webtoken;
    } else if (apitoken) {
      token = apitoken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        msg: "Login to continue",
      });
    }

    const jwt_secret = process.env.JWT_SECRET;
    if (!jwt_secret) throw new Error("JWT_SECRET env var is not set");

    const decoded = jwt.verify(token, jwt_secret) as { id: string; email: string };
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (error) {
    const isProd = process.env.NODE_ENV !== "development";
    res.clearCookie("token", {
      secure: isProd,
      sameSite: "lax",
      domain: process.env.COOKIE_DOMAIN ?? undefined,
    });

    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        msg: "Session expired",
      });
    }

    console.error("Middleware error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Error",
      msg: "Internal Server Error",
    });
  }
};
