/**
 * @fileoverview API route registry
 *
 * Registers all route modules under /api/v1/. All routes are prefixed
 * with the module name (e.g., /api/v1/levels, /api/v1/techniques).
 *
 * Route modules:
 * - levels: Difficulty level CRUD (public read, admin write)
 * - techniques: Solving technique CRUD (public read, admin write)
 * - learning: Learning content CRUD (public read, admin write)
 * - boards: Puzzle board CRUD (public read, admin write)
 * - dailies: Daily puzzle CRUD with fallback generation (public read, admin write)
 * - challenges: Challenge puzzle CRUD (public read, admin write)
 * - users: User info and subscriptions (Firebase auth required)
 * - solver: Puzzle solving, validation, generation proxy (hint access control)
 * - ratelimits: Rate limit config and history (Firebase auth required)
 * - examples: Technique example CRUD (public read, admin write)
 * - practices: Practice puzzle CRUD (public read, admin write)
 * - play: Game session management (Firebase auth required)
 * - gamification: Stats, badges, point history (public badges, auth for stats)
 * - ocr: Sudoku image extraction (public)
 */

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
import ocrRouter from "./ocr";

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
routes.route("/ocr", ocrRouter);

export default routes;
