const router = require("express").Router();
const ctrl = require("../controllers/exchangeRateController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.get("/", ctrl.get);
router.put("/", ctrl.update);
router.post("/fetch", ctrl.fetch);

module.exports = router;
