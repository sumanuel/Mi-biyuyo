const router = require("express").Router();
const ctrl = require("../controllers/statsController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.get("/summary", ctrl.summary);
router.get("/by-category", ctrl.byCategory);
router.get("/trend", ctrl.trend);

module.exports = router;
