const router = require("express").Router();
const ctrl = require("../controllers/entityController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
