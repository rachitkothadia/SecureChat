import express from "express";
import { checkAuth, login, logout, signup, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { suspendUser } from "../controllers/auth.controller.js";
import { getUserStatus } from "../controllers/auth.controller.js"; // Adjust import as needed
import { updateSuspension } from "../controllers/auth.controller.js";

const router = express.Router(); // ✅ Define router
router.put("/suspend/:userId",protectRoute, updateSuspension);
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.put("/suspend/:id", suspendUser);
router.put("/update-profile", protectRoute, updateProfile);
router.get("/check", protectRoute, checkAuth);
router.get("/user/:id",getUserStatus, async (req, res) => {
    try {
      const user = await User.findById(req.params.id); // Assuming a User model
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        _id: user._id,
        username: user.username,
        flagged: user.flagged || 0,
        suspensionexpireat: user.suspensionexpireat || null,
        banned: user.banned || false,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

export default router;
