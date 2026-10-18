import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mockRequest, resetMockState } from "../../../shared/api/mock";
import { setMockMutationListener } from "../../../shared/api/mock/legacy";
import { mock } from "../mock";

const listener = vi.fn();

beforeEach(() => {
  resetMockState();
  listener.mockClear();
  setMockMutationListener(listener);
});
afterEach(() => {
  setMockMutationListener(() => {});
  resetMockState();
});

const create = { name: "Yeni", origin: "manual", source_ids: [], gwt: { depth_insitu: 2 } };

it("serves GET /m/soil/profiles through the soil module mock", async () => {
  expect(mock.prefix).toBe("/m/soil");
  const response = await mockRequest("GET", "/m/soil/profiles");
  expect(response.status).toBe(200);
  expect((response.data as unknown[]).length).toBeGreaterThan(0);
});

it("notifies the mutation listener for POST, PUT and DELETE profiles", async () => {
  const seed = ((await mockRequest("GET", "/m/soil/profiles")).data as unknown[]).length;
  const created = await mockRequest("POST", "/m/soil/profiles", create);
  expect(created.status).toBe(200);
  expect(listener).toHaveBeenCalledTimes(1);
  const profile = created.data as { id: string };
  const put = await mockRequest("PUT", `/m/soil/profiles/${profile.id}`, created.data);
  expect(put.status).toBe(200);
  expect(listener).toHaveBeenCalledTimes(2);
  const del = await mockRequest("DELETE", `/m/soil/profiles/${profile.id}`);
  expect(del.status).toBe(200);
  expect(listener).toHaveBeenCalledTimes(3);
  expect(((await mockRequest("GET", "/m/soil/profiles")).data as unknown[]).length).toBe(seed);
});

it("returns 404 not_found for an unknown profile", async () => {
  const response = await mockRequest("GET", "/m/soil/profiles/nope");
  expect(response.status).toBe(404);
  expect(response.data).toMatchObject({ code: "not_found" });
});

it("rejects an invalid profile with 422 and does not notify", async () => {
  const id = ((await mockRequest("GET", "/m/soil/profiles")).data as { id: string }[])[0].id;
  const response = await mockRequest("PUT", `/m/soil/profiles/${id}`, { id, name: "x", layers: [], gwt: { depth_insitu: 2 } });
  expect(response.status).toBe(422);
  expect(JSON.stringify(response.data)).toContain("Invalid soil profile");
  expect(listener).not.toHaveBeenCalled();
});

it("resetMockState restores the seed profile count", async () => {
  const seed = ((await mockRequest("GET", "/m/soil/profiles")).data as unknown[]).length;
  await mockRequest("POST", "/m/soil/profiles", create);
  resetMockState();
  expect(((await mockRequest("GET", "/m/soil/profiles")).data as unknown[]).length).toBe(seed);
});
