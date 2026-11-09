const router = require("express").Router();
const ctrl = require("../controllers/adminController");
const adminGuard = require("../middleware/adminGuard");

router.use(adminGuard);
router.param("id", (req, res, next, v) =>
  /^\d+$/.test(v) ? next() : res.status(404).json({ error: "No encontrado" }),
);

router.get("/payments", ctrl.listPayments);
router.get("/payments/:id/proof", ctrl.proof);
router.post("/payments/:id/approve", ctrl.approve);
router.post("/payments/:id/reject", ctrl.reject);

router.get("/codes", ctrl.listCodes);
router.post("/codes", ctrl.createCodes);
router.delete("/codes/:id", ctrl.deleteCode);

router.get("/users", ctrl.findUsers);
router.post("/gift", ctrl.gift);
router.post("/trial/bulk", ctrl.bulkTrial);

router.get("/settings", ctrl.getSettings);
router.put("/settings", ctrl.putSettings);

router.get("/plans", ctrl.listPlans);
router.put("/plans/:code", ctrl.updatePlan);

router.get("/receivers", ctrl.listReceivers);
router.post("/receivers", ctrl.createReceiver);
router.put("/receivers/:id", ctrl.updateReceiver);
router.delete("/receivers/:id", ctrl.deleteReceiver);

module.exports = router;
