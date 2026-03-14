import aboutConfigSource from "./about.yml?raw";
import { parse } from "yaml";

export type AboutSocialId = "github" | "x" | "discord" | "steam" | "youtube";

type AboutConfig = {
  appName: string;
  author: string;
  description: string;
  stack: string;
  repo: {
    label: string;
    url: string;
  };
  socials: Array<{
    id: AboutSocialId;
    url: string;
  }>;
};

export const aboutConfig = parse(aboutConfigSource) as AboutConfig;
