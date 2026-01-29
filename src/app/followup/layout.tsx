import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Lead Feedback - LeadsHub",
  description: "Gib Feedback zu deinem Lead",
};

export default function FollowupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout doesn't include the sidebar - standalone page for brokers
  return children;
}
