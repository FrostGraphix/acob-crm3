import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { sendEnvelope } from "../services/response.js";
import {
  isTaskCategory,
  readCombinedTaskGroup,
  updateTaskGroup,
} from "../services/task-monitor.js";

export const operationsRouter = Router();

function requestBody(request: AuthenticatedRequest) {
  return typeof request.body === "object" && request.body !== null
    ? (request.body as Record<string, unknown>)
    : {};
}

operationsRouter.post("/tasks/:category/read", async (request, response) => {
  const category = request.params.category ?? "";
  if (!isTaskCategory(category)) {
    sendEnvelope(response, 404, null, `Unknown task category: ${category}`, 1);
    return;
  }

  try {
    const result = await readCombinedTaskGroup(
      request as AuthenticatedRequest,
      response,
      category,
      requestBody(request as AuthenticatedRequest),
    );
    sendEnvelope(response, 200, result, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load task operations";
    sendEnvelope(response, 502, null, message, 1);
  }
});

operationsRouter.post("/tasks/:category/update", async (request, response) => {
  const category = request.params.category ?? "";
  if (!isTaskCategory(category)) {
    sendEnvelope(response, 404, null, `Unknown task category: ${category}`, 1);
    return;
  }

  try {
    const result = await updateTaskGroup(
      request as AuthenticatedRequest,
      response,
      category,
      requestBody(request as AuthenticatedRequest),
    );

    sendEnvelope(
      response,
      result.statusCode < 400 && result.payload.code === 0 ? 200 : 502,
      result.payload.result,
      result.payload.reason || "success",
      result.payload.code,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task operation";
    sendEnvelope(response, 502, null, message, 1);
  }
});
