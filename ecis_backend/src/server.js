// require("dotenv").config();

// const app = require("./app");

// const PORT = process.env.PORT || 5000;

// const startServer = async () => {
//   try {
//     if (!process.env.DB_PASSWORD) {
//       throw new Error("DB_PASSWORD is missing from .env");
//     }

//     if (!process.env.DB_NAME) {
//       throw new Error("DB_NAME is missing from .env");
//     }

//     if (!process.env.JWT_SECRET) {
//       throw new Error("JWT_SECRET is missing from .env");
//     }

//     app.listen(PORT, () => {
//       console.log(`ECIS backend server running on port ${PORT}`);

//       console.log(`Database: ${process.env.DB_NAME}`);
//     });
//   } catch (error) {
//     console.error("Server startup failed:", error.message);

//     process.exit(1);
//   }
// };

// startServer();






require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5000;

console.log("[STARTUP] server.js loaded");

const startServer = async () => {
  try {
    console.log("[STARTUP] Checking environment variables...");

    if (!process.env.DB_PASSWORD) {
      throw new Error("DB_PASSWORD is missing from .env");
    }

    if (!process.env.DB_NAME) {
      throw new Error("DB_NAME is missing from .env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }

    console.log("[STARTUP] Environment variables OK");
    console.log(`[STARTUP] Starting HTTP server on port ${PORT}...`);

    const server = app.listen(PORT, () => {
      console.log("");
      console.log("========================================");
      console.log("ECIS BACKEND STARTED SUCCESSFULLY");
      console.log("========================================");
      console.log(`Server  : http://localhost:${PORT}`);
      console.log(`Health  : http://localhost:${PORT}/api/health`);
      console.log(`Database: ${process.env.DB_NAME}`);
      console.log("========================================");
      console.log("");
      console.log("[STARTUP] HTTP server is listening...");
    });

    server.on("error", (error) => {
      console.error("");
      console.error("[HTTP SERVER ERROR]");
      console.error(error);
    });

    server.on("close", () => {
      console.error("");
      console.error("[HTTP SERVER] Server was closed.");
    });

    process.on("SIGINT", () => {
      console.log("");
      console.log("[SHUTDOWN] SIGINT received.");

      server.close(() => {
        console.log("[SHUTDOWN] HTTP server closed.");
        process.exit(0);
      });
    });

    process.on("SIGTERM", () => {
      console.log("");
      console.log("[SHUTDOWN] SIGTERM received.");

      server.close(() => {
        console.log("[SHUTDOWN] HTTP server closed.");
        process.exit(0);
      });
    });

    process.on("uncaughtException", (error) => {
      console.error("");
      console.error("[UNCAUGHT EXCEPTION]");
      console.error(error);
    });

    process.on("unhandledRejection", (reason) => {
      console.error("");
      console.error("[UNHANDLED REJECTION]");
      console.error(reason);
    });

    process.on("beforeExit", (code) => {
      console.error("");
      console.error(`[NODE BEFORE EXIT] code=${code}`);
    });

    process.on("exit", (code) => {
      console.error("");
      console.error(`[NODE EXIT] code=${code}`);
    });
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("SERVER STARTUP FAILED");
    console.error("========================================");
    console.error(error);
    console.error("========================================");

    process.exit(1);
  }
};

startServer();