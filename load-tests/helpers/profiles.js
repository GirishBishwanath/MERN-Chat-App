const profiles = {
  smoke: {
    vus: 1,
    duration: "10s",
    ramp: 5,
    authVus: 1,
  },
  ci: {
    vus: 5,
    duration: "30s",
    ramp: 5,
    authVus: 5,
  },
};

export const profile = (name) => profiles[name] || profiles.smoke;
