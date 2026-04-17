import { signInWithSupabasePassword } from "../src/services/supabase.js";
import { env } from "../src/services/env.js";

async function debug() {
  console.log("Checking Supabase config...");
  console.log("URL:", env.supabaseUrl);
  console.log("Anon Key length:", env.supabaseAnonKey.length);
  
  try {
    console.log("Attempting test login...");
    const session = await signInWithSupabasePassword({
      email: "admin@acoblighting.com",
      password: "Abdul$amad123", // From .env
    });
    console.log("Login success:", session.user.username);
  } catch (error) {
    console.error("Login failed:", error);
  }
}

debug();
