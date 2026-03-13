import * as stytch from "stytch";
import { env } from "../env.js";

export const stytchClient = new stytch.Client({
  project_id: env.STYTCH_PROJECT_ID,
  secret: env.STYTCH_SECRET,
});
