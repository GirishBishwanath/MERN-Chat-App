const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is not configured`);
  }
  return value;
};

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number.parseInt(process.env.PORT || "3001", 10),
  mongodbUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
});
