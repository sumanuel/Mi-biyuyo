const router = require("express").Router();
const ctrl = require("../controllers/ledgerController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.get("/", ctrl.get);
router.get("/receipt/:id", ctrl.receipt);

module.exports = router;
