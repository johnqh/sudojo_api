import { Hono } from "hono";
import levelsRouter from "./levels";
import techniquesRouter from "./techniques";
import learningRouter from "./learning";
import boardsRouter from "./boards";
import dailiesRouter from "./dailies";
import challengesRouter from "./challenges";
import usersRouter from "./users";
import solverRouter from "./solver";
import ratelimitsRouter from "./ratelimits";

const routes = new Hono();

routes.route("/levels", levelsRouter);
routes.route("/techniques", techniquesRouter);
routes.route("/learning", learningRouter);
routes.route("/boards", boardsRouter);
routes.route("/dailies", dailiesRouter);
routes.route("/challenges", challengesRouter);
routes.route("/users", usersRouter);
routes.route("/solver", solverRouter);
routes.route("/ratelimits", ratelimitsRouter);

export default routes;
