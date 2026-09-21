const authService = require("../services/auth.service");

async function login(req, res) {
  try {
    const {
      username,
      password,
    } = req.body || {};

    const result =
      await authService.login({
        username,
        password,
      });

    return res.status(200).json({
      success: true,
      message:
        "Login successful.",
      data: result,
    });
  } catch (error) {
    console.error(
      "Login error:",
      error,
    );

    return res.status(401).json({
      success: false,
      message:
        error.message ||
        "Unable to sign in.",
    });
  }
}

async function refresh(req, res) {
  try {
    const {
      refreshToken,
    } = req.body || {};

    const result =
      await authService.refreshAccessToken(
        refreshToken,
      );

    return res.status(200).json({
      success: true,
      message:
        "Access token refreshed.",
      data: result,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        error.message ||
        "Refresh session is invalid.",
      code: "REFRESH_FAILED",
    });
  }
}

async function logout(req, res) {
  try {
    const {
      refreshToken,
    } = req.body || {};

    await authService.logout(
      refreshToken,
    );

    return res.status(200).json({
      success: true,
      message:
        "Logged out successfully.",
    });
  } catch (error) {
    /*
     * Logout is intentionally idempotent.
     */
    return res.status(200).json({
      success: true,
      message:
        "Logged out successfully.",
    });
  }
}

module.exports = {
  login,
  refresh,
  logout,
};