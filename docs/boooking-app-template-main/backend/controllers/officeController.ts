import { Response } from "express";
import { AuthenticatedRequest } from "../types/express.d";
import mockedUsers from "../data/mockedUsers";
import mockedRooms from "../data/mockedRooms";
import mockedRoomCategories from "../data/mockedRoomCategories";
import mockedClosures from "../data/mockedClosures";

const isBypass =
  process.env.NODE_ENV === "development" &&
  process.env.IS_AUTHENTICATED === "true";

// GET /api/v1/office/users/list
export const getOfficeUsers = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  if (isBypass) {
    return res.json({ success: true, users: mockedUsers });
  }

  const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
  const token = req.cookies.token as string;

  try {
    const response = await fetch(`${officeApiUrl}/users/listbooking/${req.user!.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Failed to fetch users from dblue-office",
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch {
    return res.status(503).json({ success: false, error: "dblue-office unavailable" });
  }
};

// GET /api/v1/office/closures/list
export const getOfficeClosures = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  if (isBypass) {
    return res.json({ success: true, closures: mockedClosures });
  }

  const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
  const token = req.cookies.token as string;

  try {
    const response = await fetch(`${officeApiUrl}/closures/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Failed to fetch closures from dblue-office",
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch {
    return res.status(503).json({ success: false, error: "dblue-office unavailable" });
  }
};

// GET /api/v1/office/users/space-access/:uid
export const getUserSpaceAccess = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const { uid } = req.params;

  if (isBypass) {
    const user = mockedUsers.find((u) => u._id === uid);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const spaceAccess = (user.space_access ?? [])
      .map((sa) => {
        const cat = mockedRoomCategories.find((rc) => rc._id === sa);
        return cat ? { label: cat.category, value: sa } : undefined;
      })
      .filter(Boolean);

    const roomlist = mockedRooms
      .filter((rm) => user.space_access?.includes(rm.category))
      .map((rm) => ({ id: rm._id, name: rm.name, space: rm.category, color: rm.color }));

    return res.json({ success: true, spaceAccess, roomlist });
  }

  const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
  const token = req.cookies.token as string;

  try {
    const response = await fetch(`${officeApiUrl}/fetch/user/space/access/${uid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Failed to fetch user space access from dblue-office",
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch {
    return res.status(503).json({ success: false, error: "dblue-office unavailable" });
  }
};

// GET /api/v1/office/rooms/list
export const getOfficeRooms = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  if (isBypass) {
    return res.json({ success: true, rooms: mockedRooms });
  }

  const officeApiUrl = process.env.DBLUE_OFFICE_API_URL;
  const token = req.cookies.token as string;

  try {
    const response = await fetch(`${officeApiUrl}/rooms/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "Failed to fetch rooms from dblue-office",
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch {
    return res.status(503).json({ success: false, error: "dblue-office unavailable" });
  }
};
