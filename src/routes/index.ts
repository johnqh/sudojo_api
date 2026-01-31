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
import examplesRouter from "./examples";
import practicesRouter from "./practices";
import playRouter from "./play";
import gamificationRouter from "./gamification";

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
routes.route("/examples", examplesRouter);
routes.route("/practices", practicesRouter);
routes.route("/play", playRouter);
routes.route("/gamification", gamificationRouter);

export default routes;
