import express from "express";
import {
  handleGoogleLogin,
  handleEmailLogin,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
} from "../controllers/authController";
import { isLoggedIn } from "../middlewares/user";

const router = express.Router();

// Public auth routes — no isLoggedIn required
router.post("/google", handleGoogleLogin);
router.post("/email", handleEmailLogin);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password", resetPassword);
router.get("/logout", logout);

// Protected — validates the session cookie
router.get("/me", isLoggedIn, getMe);

export default router;
