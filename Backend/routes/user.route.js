import express from "express";
import {
  allUsers,
  login,
  logout,
  logoutAll,
  me,
  refresh,
  signup,
} from "../controller/user.controller.js";
import secureRoute from "../middleware/secureRoute.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/logout-all", secureRoute, logoutAll);
router.get("/me", secureRoute, me);
router.get("/allusers", secureRoute, allUsers);

export default router;
