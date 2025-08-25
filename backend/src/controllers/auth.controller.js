import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;
  console.log("Received Signup Data:", req.body);

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    
    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      banned: false, // ✅ Ensure new users are not banned
      flagged: 0, // Initialize flagged count
      suspensionexpireat: null, // Initialize suspension expiry
    });

    await newUser.save();
    generateToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
    });
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Received request to suspend user with ID:", id);

    const user = await User.findById(id);
    if (!user) {
      console.log("❌ User not found:", id);
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndUpdate(id, { banned: true, suspensionexpireat: null });

    console.log("✅ User suspended successfully:", id);
    res.status(200).json({ message: "User suspended successfully" });
  } catch (error) {
    console.error("❌ Error suspending user:", error.message);
    res.status(500).json({ message: "Error suspending user", error });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 🚨 Check if user is permanently banned
    if (user.banned) {
      return res.status(403).json({ message: "🚫 You are permanently banned from logging in!" });
    }

    // 🚨 Check if user is temporarily suspended
    if (user.suspensionexpireat && new Date(user.suspensionexpireat) > new Date()) {
      return res.status(403).json({ 
        message: `⏳ You are suspended until ${new Date(user.suspensionexpireat).toLocaleString()}!` 
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in update profile:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getUserStatus = async (req, res) => {
    try {
      const user = await User.findById(req.params.id); // Fix: Use id, not userId
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        flagged: user.flagged ?? 0,
        banned: user.banned ?? false,
        suspensionexpireat: user.suspensionexpireat ?? null,
      });
    } catch (error) {
      console.error("Error fetching user status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

// ✅ Update user suspension details
export const updateSuspension = async (req, res) => {
  let { flagged, banned, suspensionexpireat } = req.body;

  // Ensure "permanent" is handled properly
  if (suspensionexpireat === "permanent") {
    suspensionexpireat = null;
    banned = true;
    isPermanentlyBanned = true;
  }
  

  try {
    console.log("Updating user with data:", { flagged, banned, suspensionexpireat });

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { flagged, banned, suspensionexpireat },
      { new: true, runValidators: true }
    );

    if (!user) {
      console.log(`User not found: ${req.params.userId}`);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("Updated user:", user);
    res.json({ message: "User updated successfully." });
  } catch (error) {
    console.error("Error updating user suspension:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
