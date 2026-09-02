import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { FriendButton } from "./FriendButton";

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("FriendButton state machine", () => {
  it("shows 'Add friend' when there is no relation", () => {
    wrap(<FriendButton userId={2} status="none" />);
    expect(screen.getByRole("button", { name: /add friend/i })).toBeInTheDocument();
  });

  it("shows a disabled 'Requested' for an outgoing pending request", () => {
    wrap(<FriendButton userId={2} status="pending_outgoing" />);
    expect(screen.getByRole("button", { name: /requested/i })).toBeDisabled();
  });

  it("shows Accept + Decline for an incoming request", () => {
    wrap(<FriendButton userId={2} status="pending_incoming" />);
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
  });

  it("shows 'Unfriend' when already friends", () => {
    wrap(<FriendButton userId={2} status="friends" />);
    expect(screen.getByRole("button", { name: /unfriend/i })).toBeInTheDocument();
  });

  it("renders nothing for self", () => {
    const { container } = wrap(<FriendButton userId={1} status="self" />);
    expect(container).toBeEmptyDOMElement();
  });
});
