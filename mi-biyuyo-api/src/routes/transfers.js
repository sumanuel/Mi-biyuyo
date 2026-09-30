const router = require("express").Router();
const ctrl = require("../controllers/transferController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.post("/", ctrl.create);
router.delete("/:id", ctrl.remove);

module.exports = router;
