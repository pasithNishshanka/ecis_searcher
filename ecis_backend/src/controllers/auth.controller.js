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
        hospitalId:
          req.body?.hospitalId,
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
        req.body?.hospitalId,
        req.body?.assignmentId,
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

async function switchHospital(req, res) {
  try {
    const result =
      await authService.switchHospitalContext({
        userId: req.user?.userId,
        hospitalId: req.body?.hospitalId,
        assignmentId: req.body?.assignmentId,
      });

    return res.status(200).json({
      success: true,
      message: "Hospital context switched.",
      data: result,
    });
  } catch (error) {
    return res.status(403).json({
      success: false,
      message:
        error.message ||
        "Unable to switch hospital context.",
    });
  }
}

async function getContext(req, res) {
  try {
    const user =
      await authService.getHospitalContext({
        userId: req.user?.userId,
        hospitalId: req.user?.hospitalId,
        assignmentId: req.user?.assignmentId,
      });

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message:
        error.message ||
        "Unable to load the authenticated user context.",
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
  switchHospital,
  getContext,
  logout,
};
