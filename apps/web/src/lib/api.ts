import { edenTreaty } from "@elysiajs/eden";
import type { App } from "@repo/api";

const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:3000";

export const api = edenTreaty<App>(API_URL);
