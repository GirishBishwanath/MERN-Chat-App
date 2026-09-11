const isObjectId = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export const sendMessageSchema = (req) => {
  const errors = {};
  const { id } = req.params;
  const { message } = req.body ?? {};

  if (!isObjectId(id)) {
    errors.id = "A valid receiver id is required";
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    errors.message = "Message must not be empty";
  } else if (message.trim().length > 5000) {
    errors.message = "Message must not exceed 5000 characters";
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

export const getMessageSchema = (req) => {
  const errors = {};
  if (!isObjectId(req.params.id)) {
    errors.id = "A valid chat user id is required";
  }
  return { valid: Object.keys(errors).length === 0, errors };
};
