import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
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
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Form>({
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
    try {
      await updateAvatar(file);
      await refreshUser();
    } catch (e) {
      setError(apiErrorMessage(e, "Could not update picture"));
    }
  };

  const field = "w-full rounded-md border px-3 py-2";

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-4 text-xl font-bold">Edit profile</h1>

      <div className="mb-4 flex items-center gap-3">
        <img
          src={user?.profile_picture_url}
          alt=""
          className="h-16 w-16 rounded-full object-cover"
        />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])}
          className="text-sm"
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <input {...register("display_name")} placeholder="Display name" className={field} />
        <input {...register("lives_in")} placeholder="Lives in" className={field} />
        <input {...register("caption")} placeholder="Caption" className={field} />
        <textarea {...register("bio")} placeholder="Bio" className={field} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-indigo-600 py-2 font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
      </form>
    </div>
  );
}
