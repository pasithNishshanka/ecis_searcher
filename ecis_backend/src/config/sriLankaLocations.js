const SRI_LANKA_LOCATIONS = Object.freeze({
  "Central Province": Object.freeze([
    "Kandy",
    "Matale",
    "Nuwara Eliya",
  ]),

  "Eastern Province": Object.freeze([
    "Ampara",
    "Batticaloa",
    "Trincomalee",
  ]),

  "North Central Province": Object.freeze([
    "Anuradhapura",
    "Polonnaruwa",
  ]),

  "North Western Province": Object.freeze([
    "Kurunegala",
    "Puttalam",
  ]),

  "Northern Province": Object.freeze([
    "Jaffna",
    "Kilinochchi",
    "Mannar",
    "Mullaitivu",
    "Vavuniya",
  ]),

  "Sabaragamuwa Province": Object.freeze([
    "Kegalle",
    "Ratnapura",
  ]),

  "Southern Province": Object.freeze([
    "Galle",
    "Matara",
    "Hambantota",
  ]),

  "Uva Province": Object.freeze([
    "Badulla",
    "Monaragala",
  ]),

  "Western Province": Object.freeze([
    "Colombo",
    "Gampaha",
    "Kalutara",
  ]),
});


function isValidProvinceDistrict(
  province,
  district,
) {
  const normalizedProvince =
    String(
      province ?? "",
    ).trim();

  const normalizedDistrict =
    String(
      district ?? "",
    ).trim();

  if (
    !normalizedProvince ||
    !normalizedDistrict
  ) {
    return false;
  }

  return Boolean(
    SRI_LANKA_LOCATIONS[
      normalizedProvince
    ]?.includes(
      normalizedDistrict,
    ),
  );
}


module.exports = {
  SRI_LANKA_LOCATIONS,
  isValidProvinceDistrict,
};