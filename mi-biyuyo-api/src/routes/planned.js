const router = require("express").Router();
const ctrl = require("../controllers/plannedController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
