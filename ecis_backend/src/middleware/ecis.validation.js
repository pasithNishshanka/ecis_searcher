const validateECISSearch = (req, res, next) => {
  const criteria = req.body || {};

  const numericFields = [
    "ageMin",
    "ageMax",
    "heightMin",
    "heightMax",
    "weightMin",
    "weightMax",
  ];

  for (const field of numericFields) {
    if (
      criteria[field] !== undefined &&
      criteria[field] !== null &&
      criteria[field] !== ""
    ) {
      const value = Number(criteria[field]);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a valid number`,
        });
      }
    }
  }

  if (
    criteria.ageMin !== undefined &&
    criteria.ageMax !== undefined &&
    criteria.ageMin !== null &&
    criteria.ageMax !== null &&
    Number(criteria.ageMin) > Number(criteria.ageMax)
  ) {
    return res.status(400).json({
      success: false,
      message: "ageMin cannot be greater than ageMax",
    });
  }

  if (
    criteria.heightMin !== undefined &&
    criteria.heightMax !== undefined &&
    criteria.heightMin !== null &&
    criteria.heightMax !== null &&
    Number(criteria.heightMin) > Number(criteria.heightMax)
  ) {
    return res.status(400).json({
      success: false,
      message: "heightMin cannot be greater than heightMax",
    });
  }

  if (
    criteria.weightMin !== undefined &&
    criteria.weightMax !== undefined &&
    criteria.weightMin !== null &&
    criteria.weightMax !== null &&
    Number(criteria.weightMin) > Number(criteria.weightMax)
  ) {
    return res.status(400).json({
      success: false,
      message: "weightMin cannot be greater than weightMax",
    });
  }

  if (
    criteria.ageMin !== undefined &&
    criteria.ageMin !== null &&
    Number(criteria.ageMin) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "ageMin cannot be negative",
    });
  }

  if (
    criteria.ageMax !== undefined &&
    criteria.ageMax !== null &&
    Number(criteria.ageMax) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "ageMax cannot be negative",
    });
  }

  if (
    criteria.heightMin !== undefined &&
    criteria.heightMin !== null &&
    Number(criteria.heightMin) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "heightMin cannot be negative",
    });
  }

  if (
    criteria.heightMax !== undefined &&
    criteria.heightMax !== null &&
    Number(criteria.heightMax) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "heightMax cannot be negative",
    });
  }

  if (
    criteria.weightMin !== undefined &&
    criteria.weightMin !== null &&
    Number(criteria.weightMin) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "weightMin cannot be negative",
    });
  }

  if (
    criteria.weightMax !== undefined &&
    criteria.weightMax !== null &&
    Number(criteria.weightMax) < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "weightMax cannot be negative",
    });
  }

  next();
};

module.exports = {
  validateECISSearch,
};
