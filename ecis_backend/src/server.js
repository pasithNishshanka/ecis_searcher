require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    if (!process.env.DB_PASSWORD) {
      throw new Error("DB_PASSWORD is missing from .env");
    }

    if (!process.env.DB_NAME) {
      throw new Error("DB_NAME is missing from .env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }

    app.listen(PORT, () => {
      console.log(`ECIS backend server running on port ${PORT}`);

      console.log(`Database: ${process.env.DB_NAME}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);

    process.exit(1);
  }
};

startServer();
