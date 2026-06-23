import User from "../models/user.model.js";

export const verifyAdminPassword = async (req) => {
  const password = String(req.body?.password || "");

  if (!password) {
    const error = new Error("Admin password is required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(req.user?._id).select("+password");
  if (!user || !["admin", "superadmin"].includes(user.role)) {
    const error = new Error("Admin account not found.");
    error.statusCode = 403;
    throw error;
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    const error = new Error("Incorrect admin password.");
    error.statusCode = 401;
    throw error;
  }

  return user;
};
