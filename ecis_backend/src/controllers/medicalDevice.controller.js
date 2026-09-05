const deviceService = require(
  '../services/medicalDevice.service'
);


async function createMedicalDevice(req, res, next) {
  try {
    const {
      patientId,
      deviceType,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'patientId is required',
      });
    }

    if (!deviceType || !deviceType.trim()) {
      return res.status(400).json({
        success: false,
        message: 'deviceType is required',
      });
    }

    const device =
      await deviceService.createMedicalDevice(
        req.body
      );

    return res.status(201).json({
      success: true,
      message: 'Medical device record created successfully',
      data: device,
    });

  } catch (error) {
    next(error);
  }
}


async function getPatientMedicalDevices(req, res, next) {
  try {
    const { patientId } = req.params;

    const devices =
      await deviceService.getPatientMedicalDevices(
        patientId
      );

    return res.status(200).json({
      success: true,
      count: devices.length,
      data: devices,
    });

  } catch (error) {
    next(error);
  }
}


async function getMedicalDeviceById(req, res, next) {
  try {
    const { deviceId } = req.params;

    const device =
      await deviceService.getMedicalDeviceById(
        deviceId
      );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Medical device record not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: device,
    });

  } catch (error) {
    next(error);
  }
}


module.exports = {
  createMedicalDevice,
  getPatientMedicalDevices,
  getMedicalDeviceById,
};