const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

export const signupSchema = (req) => {
  const { fullname, email, password, confirmPassword } = req.body ?? {};
  const errors = {};

  if (!isNonEmptyString(fullname) || fullname.trim().length < 2) {
    errors.fullname = "Full name must contain at least 2 characters";
  }
  if (!isNonEmptyString(email) || !email.includes("@")) {
    errors.email = "A valid email is required";
  }
  if (!isNonEmptyString(password) || password.length < 8) {
    errors.password = "Password must contain at least 8 characters";
  }
  if (typeof confirmPassword !== "string") {
    errors.confirmPassword = "Password confirmation is required";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

export const loginSchema = (req) => {
  const { email, password } = req.body ?? {};
  const errors = {};

  if (!isNonEmptyString(email) || !email.includes("@")) {
    errors.email = "A valid email is required";
  }
  if (!isNonEmptyString(password)) {
    errors.password = "Password is required";
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

export const noBodySchema = (req) => ({
  valid: req.body == null || Object.keys(req.body).length === 0,
  errors: { body: "Request body is not allowed" },
});
