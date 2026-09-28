const router = require("express").Router();
const ctrl = require("../controllers/transactionController");
const paymentCtrl = require("../controllers/paymentController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.get("/:id", ctrl.get);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

// Payments (abonos) nested under transaction
router.get("/:id/payments", paymentCtrl.list);
router.post("/:id/payments", paymentCtrl.create);
router.delete("/:id/payments/:paymentId", paymentCtrl.remove);

module.exports = router;
