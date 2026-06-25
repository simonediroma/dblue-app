import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { AuthenticatedRequest } from "../types/express.d";
import mockedUsers from "../data/mockedUsers";

const isProd = process.env.NODE_ENV === "production";

const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  domain: process.env.COOKIE_DOMAIN || undefined,
  expires: new Date(
    Date.now() + parseInt(process.env.COOKIE_TIME || "60") * 24 * 60 * 60 * 1000
  ),
});

const cookieClearOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  domain: process.env.COOKIE_DOMAIN || undefined,
};

// POST /api/v1/auth/google
// Body: { credential: string }  — GIS ID token from the frontend
export const handleGoogleLogin = async (req: Request, res: Response) => {
  const { credential } = req.body as { credential?: string };
  if (!credential) {
    return res.status(400).json({ success: false, error: "Missing credential." });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ success: false, error: "Google client ID not configured." });
  }

  try {
    // Verify the GIS ID token and check the hosted domain
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    if (!payload || payload.hd !== "dblue.it") {
      return res.status(403).json({
        success: false,
        error: "Only @dblue.it Google accounts are allowed.",
      });
    }

    // Proxy to dblue-office to get a JWT for this verified email
    const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
    const response = await fetch(`${officeApiUrl}/auth/google/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: payload.email }),
    });

    const data = (await response.json()) as {
      success: boolean;
      error?: string;
      message?: string;
      user?: { token: string; id: string; name: string; email: string; role: string; login_method: string; tool_access: string[]; app_access?: string[]; status: boolean };
    };

    if (!response.ok || !data.success || !data.user) {
      return res.status(response.status).json({
        success: false,
        error: data.error || data.message || "Authentication failed.",
      });
    }

    return res
      .cookie("token", data.user.token, cookieOptions())
      .json({ success: true, user: data.user });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({ success: false, error: "Google authentication failed." });
  }
};

// POST /api/v1/auth/email
// Body: { email: string, password: string }
export const handleEmailLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required." });
  }

  try {
    const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
    const response = await fetch(`${officeApiUrl}/auth/email/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = (await response.json()) as {
      success: boolean;
      error?: string;
      message?: string;
      user?: { token: string; id: string; name: string; email: string; role: string; login_method: string; tool_access: string[]; app_access?: string[]; status: boolean };
    };

    if (!response.ok || !data.success || !data.user) {
      return res.status(response.status).json({
        success: false,
        error: data.error || data.message || "Invalid credentials.",
      });
    }

    return res
      .cookie("token", data.user.token, cookieOptions())
      .json({ success: true, user: data.user });
  } catch (error) {
    console.error("Email login error:", error);
    return res.status(500).json({ success: false, error: "Login failed." });
  }
};

// GET /api/v1/auth/me
// Validates the session and returns the full user profile.
export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  // Dev bypass — IS_AUTHENTICATED injects req.user; return a full mocked user
  if (
    process.env.NODE_ENV === "development" &&
    process.env.IS_AUTHENTICATED === "true"
  ) {
    const devUser = mockedUsers.find((u) => u.email === req.user!.email) ?? mockedUsers[0];
    return res.json({
      success: true,
      user: {
        id: devUser._id,
        name: devUser.name,
        email: devUser.email,
        role: devUser.role,
        employment_type: devUser.employment_type,
        job_title: devUser.job_title,
        contract_type: devUser.contract_type ?? "",
        contract_percentage: devUser.contract_percentage ?? null,
        mandatory_presence_days: devUser.mandatory_presence_days ?? null,
        image_url: devUser.image_url ?? null,
        space_access: devUser.space_access ?? [],
        login_method: devUser.login_method,
        tool_access: devUser.tool_access ?? [],
        app_access: devUser.app_access ?? [process.env.APP_ID || "booking-app"],
        status: devUser.status,
      },
    });
  }

  const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
  const appId = process.env.APP_ID;
  const token = req.cookies.token as string;

  try {
    // Step 1 — check the user has access to this specific app
    const accessResponse = await fetch(
      `${officeApiUrl}/users/check-app-access?app=${appId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!accessResponse.ok) {
      return res.status(accessResponse.status === 401 ? 401 : 503).json({
        success: false,
        error: "Authorization service unavailable.",
      });
    }

    const accessData = (await accessResponse.json()) as { success: boolean; authorized: boolean };
    if (!accessData.authorized) {
      return res.status(403).json({ success: false, error: "Access denied." });
    }

    // Step 2 — fetch the full user profile
    const sessionResponse = await fetch(
      `${officeApiUrl}/auth/fetch/session`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!sessionResponse.ok) {
      return res.status(503).json({ success: false, error: "Authorization service unavailable." });
    }

    const sessionData = (await sessionResponse.json()) as {
      success: boolean;
      user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        employment_type: string;
        job_title: string;
        contract_type: string;
        contract_percentage: number | null;
        mandatory_presence_days: number | null;
        image_url: string | null;
        space_access: string[];
        tool_access: string[];
        app_access?: string[];
        status: boolean;
        login_method: string;
        token: string;
      };
    };

    if (!sessionData.success || !sessionData.user) {
      return res.status(401).json({ success: false, error: "Session invalid." });
    }

    return res.json({ success: true, user: sessionData.user });
  } catch {
    return res.status(503).json({ success: false, error: "Authorization service unavailable." });
  }
};

// GET /api/v1/auth/logout
export const logout = (_req: Request, res: Response) => {
  return res
    .clearCookie("token", cookieClearOptions)
    .json({ success: true });
};

// POST /api/v1/auth/forgot-password
// Body: { email: string }  — proxied to dblue-office (public, no auth)
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required." });
  }

  try {
    const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
    const response = await fetch(`${officeApiUrl}/auth/request/reset/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch {
    return res.status(503).json({ success: false, error: "Service unavailable." });
  }
};

// PUT /api/v1/auth/reset-password
// Body: { email, password, resetcode }  — proxied to dblue-office (public, no auth)
export const resetPassword = async (req: Request, res: Response) => {
  const { email, password, resetcode } = req.body as {
    email?: string;
    password?: string;
    resetcode?: string;
  };
  if (!email || !password || !resetcode) {
    return res.status(400).json({ success: false, error: "email, password and resetcode are required." });
  }

  try {
    const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
    const response = await fetch(`${officeApiUrl}/auth/verify/reset/token`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, resetcode }),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch {
    return res.status(503).json({ success: false, error: "Service unavailable." });
  }
};
