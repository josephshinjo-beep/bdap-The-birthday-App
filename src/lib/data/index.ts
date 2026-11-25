"use client";
// Picks the data layer: "mock" when Supabase env vars are missing, else "supabase".
// Set NEXT_PUBLIC_DATA_MODE=mock to force the mock even with Supabase configured.
import { hasSupabase } from "@/lib/supabase/env";
import type { DataApi } from "./api";
import { mockApi } from "./mock";
import { supabaseApi } from "./supabase";

export const dataMode = process.env.NEXT_PUBLIC_DATA_MODE === "mock" || !hasSupabase ? "mock" : "supabase";

export const data: DataApi = dataMode === "mock" ? mockApi : supabaseApi;

export type { DataApi } from "./api";
