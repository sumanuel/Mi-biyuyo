const { getPlanState, listPlans } = require("../utils/subscription");

// Estado del plan del usuario y planes a la venta (precio y días)
exports.get = async (req, res, next) => {
  try {
    res.json({
      ...(await getPlanState(req.user.id)),
      plans: await listPlans(),
    });
  } catch (err) {
    next(err);
  }
};
