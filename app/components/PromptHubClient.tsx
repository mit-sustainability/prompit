"use client";

import dynamic from "next/dynamic";

const PromptHubNoSSR = dynamic(() => import("@/app/components/PromptHub").then((m) => m.PromptHub), {
  ssr: false
});

export function PromptHubClient() {
  return <PromptHubNoSSR />;
}
