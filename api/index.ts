import { createApp } from "../backend/src/app.js";

// This is the main serverless function handler for Vercel.
// It imports the Express app factory from the backend package
// and exports the initialized app for Vercel's Node.js runtime.
const app = createApp();

export default app;
