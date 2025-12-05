import { Hono } from "hono";
import levels from "./levels";
import techniques from "./techniques";
import learning from "./learning";
import boards from "./boards";
import dailies from "./dailies";
import challenges from "./challenges";

const routes = new Hono();

routes.route("/levels", levels);
routes.route("/techniques", techniques);
routes.route("/learning", learning);
routes.route("/boards", boards);
routes.route("/dailies", dailies);
routes.route("/challenges", challenges);

export default routes;
