const authService = require("../services/auth.service");

const login = async (req, res) => {
  try {
    const {
      username,
      password,
    } = req.body || {};

    const result = await authService.login({
      username,
      password,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  login,
};