import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../api/auth";
import { useAuth } from "../auth/useAuth";
import { apiErrorMessage } from "../api/axiosClient";
import { useObjectUrl } from "../hooks/useObjectUrl";

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

  const field = "w-full rounded-md border px-3 py-2";

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-indigo-600">Create your account</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <input {...register("email")} placeholder="Email" className={field} />
        {errors.email && <p className="text-xs text-rose-600">{errors.email.message}</p>}

        <input {...register("username")} placeholder="Username" className={field} />
        {errors.username && <p className="text-xs text-rose-600">{errors.username.message}</p>}

        <input
          {...register("password")}
          type="password"
          placeholder="Password"
          className={field}
        />
        {errors.password && <p className="text-xs text-rose-600">{errors.password.message}</p>}

        <input {...register("display_name")} placeholder="Display name (optional)" className={field} />

        <input {...register("lives_in")} placeholder="Lives in *" className={field} />
        {errors.lives_in && <p className="text-xs text-rose-600">{errors.lives_in.message}</p>}

        <input {...register("caption")} placeholder="Caption *" className={field} />
        {errors.caption && <p className="text-xs text-rose-600">{errors.caption.message}</p>}

        <textarea {...register("bio")} placeholder="Bio (optional)" className={field} />

        <div>
          <label className="mb-1 block text-sm font-medium">Profile picture *</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              setPictureError(null);
              setPicture(e.target.files?.[0] ?? null);
            }}
            className="block w-full text-sm"
          />
          {preview && (
            <img
              src={preview}
              alt="preview"
              className="mt-2 h-20 w-20 rounded-full object-cover"
            />
          )}
          {pictureError && <p className="text-xs text-rose-600">{pictureError}</p>}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-600 py-2 font-medium text-white disabled:opacity-50"
        >
          Sign up
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        Already have an account?{" "}
        <Link to="/login" className="text-indigo-600">
          Log in
        </Link>
      </p>
    </div>
  );
}
