import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import axios from "axios";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js"; // Ensure socket.js is set up

dotenv.config(); // Loads environment variables

// Log to check if PORT and MONGODB_URI are properly loaded
console.log("PORT:", process.env.PORT);
console.log("MONGODB_URI:", process.env.MONGODB_URI);

const PORT = process.env.PORT || 5001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// ML API proxy route
app.post("/api/ml/predict", async (req, res) => {
  try {
    const mlPort = process.env.ML_PORT || 5002;
    const { data } = await axios.post(`http://127.0.0.1:${mlPort}/predict`, req.body, {
      headers: { "Content-Type": "application/json" },
    });
    res.json(data);
  } catch (error) {
    const status = error?.response?.status || 500;
    res.status(status).json({ error: error?.response?.data || error.message });
  }
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Spawn Python ML API
const spawnMlApi = () => {
  const mlPort = process.env.ML_PORT || "5002";
  const pythonCmd = process.env.PYTHON_PATH || "python";
  const mlCwd = path.join(__dirname, "..");
  const mlScript = path.join(mlCwd, "src", "ml_api", "app.py");

  const py = spawn(pythonCmd, [mlScript], {
    cwd: mlCwd,
    env: { ...process.env, PORT: mlPort, FLASK_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  py.stdout.on("data", (d) => process.stdout.write(`[ML] ${d}`));
  py.stderr.on("data", (d) => process.stderr.write(`[ML] ${d}`));
  py.on("close", (code) => console.log(`[ML] exited with code ${code}`));

  return py;
};

// Start server and connect to DB
server.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
  connectDB();
  spawnMlApi();
});
