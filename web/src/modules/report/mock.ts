import { NOT_HANDLED, type MockHandler } from "../../shared/api/mock/dispatcher";

const PREFIX = "/m/report";

const handle: MockHandler = (method, path) => {
  if (method.toUpperCase() !== "POST" || path.split("?")[0] !== `${PREFIX}/run`) {
    return NOT_HANDLED;
  }
  return {
    status: 501,
    data: {
      code: "not_implemented",
      message: "This operation is not implemented.",
      details: {},
      missing_factors: [],
    },
  };
};

export const mock = { prefix: PREFIX, handle };
