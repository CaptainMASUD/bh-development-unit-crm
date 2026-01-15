// src/utils/accessMatch.js
import mongoose from "mongoose";

export function customerAccessMatch(user) {
  const userId = new mongoose.Types.ObjectId(user._id);

  switch (user.role) {
    case "superadmin":
      return {}; // all customers
    case "admin":
      return {}; // all customers (change if admin should be scoped)
    case "employee":
      // common: employee sees assigned OR created
      return { $or: [{ assignedTo: userId }, { createdBy: userId }] };
    case "marketing_team":
      // common: marketing sees lead-origin OR created by them
      return { $or: [{ origin: "lead" }, { createdBy: userId }] };
    default:
      return { _id: null }; // sees nothing
  }
}

export function canSeeUserCounts(user) {
  return ["admin", "superadmin"].includes(user.role);
}

export function canSeeSuperAdminCounts(user) {
  return user.role === "superadmin";
}
