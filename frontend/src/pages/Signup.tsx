import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../api/auth";
import { useAuth } from "../auth/useAuth";
import { apiErrorMessage } from "../api/axiosClient";
import { useObjectUrl } from "../hooks/useObjectUrl";
import { AuthLayout } from "../components/AuthLayout";
import { PlusIcon } from "../components/icons";

const schema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[A-Za-z0-9_.]+$/, "Letters, digits, _ and . only"),
  password: z.string().min(8, "At least 8 characters"),
  display_name: z.string().max(80).optional(),
  lives_in: z.string().min(1, "Required").max(120),
  caption: z.string().min(1, "Required").max(200),
  bio: z.string().max(500).optional(),
});
type Form = z.infer<typeof schema>;

export function Signup() {
  const navigate = useNavigate();
  const { loginWithTokens } = useAuth();
  const [picture, setPicture] = useState<File | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const preview = useObjectUrl(picture);

  const onSubmit = async (data: Form) => {
    setError(null);
    if (!picture) {
      setPictureError("A profile picture is required");
      return;
    }
    try {
      const res = await signup({ ...data, profile_picture: picture });
      await loginWithTokens(res.access_token, res.refresh_token, res.user);
      navigate("/feed", { replace: true });
    } catch (e) {
      setError(apiErrorMessage(e, "Sign up failed"));
    }
  };

  const err = (m?: string) => m && <p className="mt-1 text-xs text-rose-600">{m}</p>;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Takes a minute. A profile picture is required."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div className="flex items-center gap-4">
          <label className="group relative shrink-0 cursor-pointer">
            {preview ? (
              <img
                src={preview}
                alt="preview"
                className="h-16 w-16 rounded-2xl object-cover ring-2 ring-brand-200"
              />
            ) : (
              <span className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition group-hover:border-brand-300 group-hover:text-brand-500">
                <PlusIcon className="text-xl" />
              </span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                setPictureError(null);
                setPicture(e.target.files?.[0] ?? null);
              }}
              className="hidden"
            />
          </label>
          <div className="text-sm">
            <p className="font-semibold text-slate-700">Profile picture *</p>
            <p className="text-xs text-slate-400">JPG, PNG or WebP</p>
            {err(pictureError || undefined)}
          </div>
        </div>

        <div>
          <input {...register("email")} placeholder="Email" className="input" />
          {err(errors.email?.message)}
        </div>
        <div>
          <input {...register("username")} placeholder="Username" className="input" />
          {err(errors.username?.message)}
        </div>
        <div>
          <input
            {...register("password")}
            type="password"
            placeholder="Password"
            className="input"
          />
          {err(errors.password?.message)}
        </div>
        <input
          {...register("display_name")}
          placeholder="Display name (optional)"
          className="input"
        />
        <div>
          <input {...register("lives_in")} placeholder="Lives in *" className="input" />
          {err(errors.lives_in?.message)}
        </div>
        <div>
          <input {...register("caption")} placeholder="Caption *" className="input" />
          {err(errors.caption?.message)}
        </div>
        <textarea
          {...register("bio")}
          placeholder="Bio (optional)"
          rows={2}
          className="input resize-none"
        />

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
        <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
          {isSubmitting ? "Creating…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
