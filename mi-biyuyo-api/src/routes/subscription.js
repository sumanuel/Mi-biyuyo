const router = require("express").Router();
const ctrl = require("../controllers/subscriptionController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.get("/", ctrl.get);

module.exports = router;
