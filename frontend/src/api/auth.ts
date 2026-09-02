import { api } from "./axiosClient";
import type { SignupResponse, TokenPair, UserMe } from "../types";

export interface SignupInput {
  email: string;
  username: string;
  password: string;
  lives_in: string;
  caption: string;
  display_name?: string;
  bio?: string;
  profile_picture: File;
}

export async function signup(input: SignupInput): Promise<SignupResponse> {
  const fd = new FormData();
  fd.append("email", input.email);
  fd.append("username", input.username);
  fd.append("password", input.password);
  fd.append("lives_in", input.lives_in);
  fd.append("caption", input.caption);
  if (input.display_name) fd.append("display_name", input.display_name);
  if (input.bio) fd.append("bio", input.bio);
  fd.append("profile_picture", input.profile_picture);
  const { data } = await api.post<SignupResponse>("/auth/signup", fd);
  return data;
}

export async function login(emailOrUsername: string, password: string): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/auth/login", {
    email_or_username: emailOrUsername,
    password,
  });
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post("/auth/logout", { refresh_token: refreshToken });
}

export async function getMe(): Promise<UserMe> {
  const { data } = await api.get<UserMe>("/users/me");
  return data;
}
