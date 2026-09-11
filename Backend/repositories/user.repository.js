import User from "../models/user.model.js";

export const findByEmail = (email, includePassword = false) => {
  const query = User.findOne({ email });
  return includePassword ? query.select("+password") : query;
};

export const createUser = (data) => User.create(data);

export const findPublicById = (id) =>
  User.findById(id).select("_id fullname email");

export const findById = (id) => User.findById(id).select("_id");

export const listExcept = (userId) =>
  User.find({ _id: { $ne: userId } }).select("_id fullname email");
