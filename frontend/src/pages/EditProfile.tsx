import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { updateAvatar, updateMe } from "../api/users";
import { useAuth } from "../auth/useAuth";
import { apiErrorMessage } from "../api/axiosClient";

interface Form {
  display_name: string;
  bio: string;
  lives_in: string;
  caption: string;
}

export function EditProfile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Form>({
    defaultValues: {
      display_name: user?.display_name ?? "",
      bio: user?.bio ?? "",
      lives_in: user?.lives_in ?? "",
      caption: user?.caption ?? "",
    },
  });

  const onSubmit = async (data: Form) => {
    setError(null);
    try {
      await updateMe(data);
      await refreshUser();
      navigate(`/users/${user!.id}`);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save"));
    }
  };

  const onAvatar = async (file: File) => {
    setAvatarBusy(true);
    setError(null);
    try {
      await updateAvatar(file);
      await refreshUser();
    } catch (e) {
      setError(apiErrorMessage(e, "Could not update picture"));
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[600px] px-3 py-5 sm:px-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Edit profile</h1>
        {user && (
          <Link to={`/users/${user.id}`} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            Cancel
          </Link>
        )}
      </div>

      <div className="card animate-fade-in p-5">
        <div className="mb-5 flex items-center gap-4">
          <img
            src={user?.profile_picture_url}
            alt=""
            className="h-20 w-20 rounded-2xl object-cover ring-4 ring-white"
          />
          <div>
            <label className="btn btn-soft cursor-pointer text-xs">
              {avatarBusy ? "Uploading…" : "Change photo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])}
                className="hidden"
              />
            </label>
            <p className="mt-1.5 text-xs text-slate-400">JPG, PNG or WebP</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <input {...register("display_name")} placeholder="Display name" className="input" />
          <input {...register("lives_in")} placeholder="Lives in" className="input" />
          <input {...register("caption")} placeholder="Caption" className="input" />
          <textarea
            {...register("bio")}
            placeholder="Bio"
            rows={3}
            className="input resize-none"
          />
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
