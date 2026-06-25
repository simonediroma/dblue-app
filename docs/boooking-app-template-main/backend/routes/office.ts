import express from "express";
import { getOfficeUsers, getOfficeRooms, getOfficeClosures, getUserSpaceAccess } from "../controllers/officeController";
import { isLoggedIn } from "../middlewares/user";

const router = express.Router();

router.get("/users/list", isLoggedIn, getOfficeUsers);
router.get("/users/space-access/:uid", isLoggedIn, getUserSpaceAccess);
router.get("/rooms/list", isLoggedIn, getOfficeRooms);
router.get("/closures/list", isLoggedIn, getOfficeClosures);

export default router;
