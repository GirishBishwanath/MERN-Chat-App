import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "../utils/axiosConfig";
import { useAuth } from "../context/AuthProvider";
import type { ApiErrorResponse, AuthResponse } from "../types/api";

interface LoginForm {
  email: string;
  password: string;
}

function Login() {
  const { setAuthUser } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm): Promise<void> => {
    try {
      const response = await axios.post<AuthResponse>("/api/user/login", data);
      setAuthUser(response.data.user);
      toast.success("Login successful");
    } catch (error: unknown) {
      const message = axios.isAxiosError<ApiErrorResponse>(error)
        ? error.response?.data?.error
        : undefined;
      toast.error(message || "Unable to log in");
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
          Login with your <span className="text-blue-600 font-semibold">Account</span>
        </h2>

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
            autoComplete="current-password"
            {...register("password", { required: true })}
          />
        </label>
        {errors.password && (
          <span className="text-red-500 text-sm font-semibold">This field is required</span>
        )}

        <div className="flex justify-center">
          <input
            type="submit"
            value="Login"
            className="text-white bg-blue-600 cursor-pointer w-full rounded-lg py-2"
          />
        </div>
        <p>
          Don&apos;t have any Account?{" "}
          <Link to="/signup" className="text-blue-500 underline cursor-pointer ml-1">
            Signup
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
