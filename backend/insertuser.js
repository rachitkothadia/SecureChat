import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/user.model.js"; // ✅ Correct path
 // Adjust the path

async function insertTestUser() {
  await mongoose.connect("mongodb://localhost:27017/yourDatabaseName", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const hashedPassword = await bcrypt.hash("Test@1234", 10);

  const testUser = new User({
    fullName: "Test User",
    email: "test@example.com",
    password: hashedPassword,
    banned: false,
    flagged: 0,
    suspensionexpireat: null,
  });

  await testUser.save();
  console.log("✅ Test user inserted:", testUser);
  mongoose.connection.close();
}

insertTestUser().catch((error) => console.error("❌ Error:", error));
