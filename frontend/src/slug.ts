export const DEFAULT_SLUG = "hackathon";

/**
 * A group is a URL slug and a link is access — no auth, no registration, no
 * invites. Twenty lines here instead of a router dependency.
 */
export const slugFromPath = (pathname: string): string => {
  const match = /^\/g\/([^/?#]+)/.exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : DEFAULT_SLUG;
};

export const isDemo = (search: string): boolean => new URLSearchParams(search).get("demo") === "1";
