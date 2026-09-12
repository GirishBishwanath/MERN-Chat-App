import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "../utils/axiosConfig";
import { useAuth } from "../context/AuthProvider";
import type { AuthResponse, ApiErrorResponse } from "../types/api";
import { isAxiosError } from "axios";

interface SignupForm {
  fullname: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function Signup() {
  const { setAuthUser } = useAuth();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>();

  const password = watch("password", "");

  const onSubmit = async (data: SignupForm): Promise<void> => {
    try {
      const response = await axios.post<AuthResponse>("/api/user/signup", data);
      setAuthUser(response.data.user);
      toast.success("Signup successful");
    } catch (error: unknown) {
      const message = isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data?.error
        : undefined;
      toast.error(message || "Unable to create account");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="border border-black px-6 py-2 rounded-md space-y-3 w-96"
      >
        <h1 className="text-2xl items-center text-blue-600 font-bold">Messenger</h1>
        <h2 className="text-2xl items-center">
          Create a new <span className="text-blue-600 font-semibold">Account</span>
        </h2>

        <label className="input input-bordered flex items-center gap-2">
          <input
            type="text"
            className="grow"
            placeholder="Fullname"
            autoComplete="name"
            {...register("fullname", { required: true })}
          />
        </label>
        {errors.fullname && (
          <span className="text-red-500 text-sm font-semibold">This field is required</span>
        )}

        <label className="input input-bordered flex items-center gap-2">
          <input
            type="email"
            className="grow"
            placeholder="Email"
            autoComplete="email"
            {...register("email", { required: true })}
          />
        </label>
        {errors.email && (
          <span className="text-red-500 text-sm font-semibold">This field is required</span>
        )}

        <label className="input input-bordered flex items-center gap-2">
          <input
            type="password"
            className="grow"
            placeholder="password"
            autoComplete="new-password"
            {...register("password", { required: true })}
          />
        </label>
        {errors.password && (
          <span className="text-red-500 text-sm font-semibold">This field is required</span>
        )}

        <label className="input input-bordered flex items-center gap-2">
          <input
            type="password"
            className="grow"
            placeholder="confirm password"
            autoComplete="new-password"
            {...register("confirmPassword", {
              required: true,
              validate: (value) => value === password || "Passwords do not match",
            })}
          />
        </label>
        {errors.confirmPassword && (
          <span className="text-red-500 text-sm font-semibold">
            {errors.confirmPassword.message || "This field is required"}
          </span>
        )}

        <div className="flex justify-center">
          <input
            type="submit"
            value="Signup"
            className="text-white bg-blue-600 cursor-pointer w-full rounded-lg py-2"
          />
        </div>
        <p>
          Have any Account?{" "}
          <Link to="/login" className="text-blue-500 underline cursor-pointer ml-1">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;
