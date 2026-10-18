import { afterEach, beforeEach, expect, it } from "vitest";
import { mockRequest, registerMockHandlers, resetMockState } from "../../../shared/api/mock";
import { mock } from "../mock";

beforeEach(() => resetMockState());
afterEach(() => resetMockState());

it("serves GET /m/soil/profiles through the soil module mock", async () => {
  expect(mock.prefix).toBe("/m/soil");
  registerMockHandlers(mock.prefix, mock.handle);
  const response = await mockRequest("GET", "/m/soil/profiles");
  expect(response.status).toBe(200);
  expect((response.data as unknown[]).length).toBeGreaterThan(0);
  expect(mock.handle("GET", "/m/soil/profiles", undefined)).toMatchObject({ status: 200 });
});
