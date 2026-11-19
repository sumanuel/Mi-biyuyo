const router = require("express").Router();
const ctrl = require("../controllers/announcementsController");
const authGuard = require("../middleware/authGuard");

router.use(authGuard);
router.get("/", ctrl.listPublic);

module.exports = router;
