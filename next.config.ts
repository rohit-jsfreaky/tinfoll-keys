import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CLAUDE.md here is hand-written and is the entry point for the project.
  // Next appends its own agent-rules block to it on every dev run; turn that off.
  agentRules: false,
};

export default nextConfig;
