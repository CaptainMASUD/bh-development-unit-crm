import jwt from "jsonwebtoken"
import User from "../models/user.model.js"

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIREY || "7d",
  })
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." })
    }

    const user = await User.findOne({ email }).select("+password")
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." })
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is disabled. Contact admin." })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." })
    }

    const token = signToken(user._id)
    user.password = undefined

    return res.status(200).json({
      message: "Login successful.",
      token,
      user,
    })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in login.",
      error: err.message,
    })
  }
}

export const register = async (req, res) => {
  try {
    // ⚠️ no security (as you requested): anyone can choose role (including superadmin / marketing_team)
    const { name, email, password, role, isActive } = req.body

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "name, email, password and role are required.",
      })
    }

    // ✅ Added marketing_team
    const allowedRoles = ["superadmin", "admin", "employee", "marketing_team"]
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: 'role must be "superadmin", "admin", "employee" or "marketing_team".',
      })
    }

    const exists = await User.findOne({ email })
    if (exists) {
      return res.status(409).json({ message: "Email already exists." })
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      isActive: isActive ?? true,
    })

    return res.status(201).json({
      message: "User registered successfully.",
      user,
    })
  } catch (err) {
    return res.status(500).json({
      message: "Server error in register.",
      error: err.message,
    })
  }
}
