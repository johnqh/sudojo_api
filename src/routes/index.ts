import { Hono } from "hono";
import levelsRouter from "./levels";
import techniquesRouter from "./techniques";
import learningRouter from "./learning";
import boardsRouter from "./boards";
import dailiesRouter from "./dailies";
import challengesRouter from "./challenges";

const routes = new Hono();

routes.route("/levels", levelsRouter);
routes.route("/techniques", techniquesRouter);
routes.route("/learning", learningRouter);
routes.route("/boards", boardsRouter);
routes.route("/dailies", dailiesRouter);
routes.route("/challenges", challengesRouter);

export default routes;
