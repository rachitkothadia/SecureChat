import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Ensure this exists
  profilePic: { type: String, default: "" },
  flagged: { type: Number, default: 0 },
  banned: { type: Boolean, default: false },
  suspensionexpireat: { type: Date, default: null },
  isPermanentlyBanned: { type: Boolean, default: false }
});

export default mongoose.model("User", userSchema);
