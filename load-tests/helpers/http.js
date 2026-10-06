import { check, fail } from "k6";

export const parseJson = (response) => {
  try {
    return response.json();
  } catch {
    return null;
  }
};

export const expectStatus = (response, expected, label) => {
  check(response, { [label]: (res) => res.status === expected });
  if (response.status !== expected) {
    fail(label + ": expected " + expected + ", received " + response.status);
  }
};
