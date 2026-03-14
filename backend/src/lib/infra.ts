/**
 * Infrastructure provider abstraction
 *
 * Routes to either Fly.io or Docker host based on INFRA_PROVIDER env var.
 * Both providers export the same interface.
 */

import { env } from "../env.js";
import * as fly from "./fly.js";
import * as docker from "./docker-host.js";

const provider = env.INFRA_PROVIDER === "fly" ? fly : docker;

export const createMachine = provider.createMachine;
export const getMachine = provider.getMachine;
export const startMachine = provider.startMachine;
export const stopMachine = provider.stopMachine;
export const deleteMachine = provider.deleteMachine;
export const execInMachine = provider.execInMachine;
export const listMachines = provider.listMachines;
export const updateMachine = provider.updateMachine;
export const deleteVolume = provider.deleteVolume;
