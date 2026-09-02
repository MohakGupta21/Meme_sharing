import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { apiErrorMessage } from "../api/axiosClient";

const schema = z.object({
  email_or_username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});
type Form = z.infer<typeof schema>;

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname: string } } };
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setError(null);
    try {
      await login(data.email_or_username, data.password);
      navigate(location.state?.from?.pathname ?? "/feed", { replace: true });
    } catch (e) {
      setError(apiErrorMessage(e, "Login failed"));
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-indigo-600">MemeShare</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <input
            {...register("email_or_username")}
            placeholder="Email or username"
            className="w-full rounded-md border px-3 py-2"
          />
          {errors.email_or_username && (
            <p className="text-xs text-rose-600">{errors.email_or_username.message}</p>
          )}
        </div>
        <div>
          <input
            {...register("password")}
            type="password"
            placeholder="Password"
            className="w-full rounded-md border px-3 py-2"
          />
          {errors.password && <p className="text-xs text-rose-600">{errors.password.message}</p>}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-600 py-2 font-medium text-white disabled:opacity-50"
        >
          Log in
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        No account?{" "}
        <Link to="/signup" className="text-indigo-600">
          Sign up
        </Link>
      </p>
    </div>
  );
}
