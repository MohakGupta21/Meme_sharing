import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { apiErrorMessage } from "../api/axiosClient";
import { AuthLayout } from "../components/AuthLayout";

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
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see what your friends have been posting."
      footer={
        <>
          No account?{" "}
          <Link to="/signup" className="font-semibold text-brand-600 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <input
            {...register("email_or_username")}
            placeholder="Email or username"
            className="input"
          />
          {errors.email_or_username && (
            <p className="mt-1 text-xs text-rose-600">{errors.email_or_username.message}</p>
          )}
        </div>
        <div>
          <input
            {...register("password")}
            type="password"
            placeholder="Password"
            className="input"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
          )}
        </div>
        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
