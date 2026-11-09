const router = require("express").Router();
const ctrl = require("../controllers/subscriptionController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.get("/", ctrl.get);
router.get("/receivers", ctrl.receivers);
router.get("/payments", ctrl.listPayments);
router.post("/payments", ctrl.createPayment);
router.post("/redeem", ctrl.redeem);

module.exports = router;
