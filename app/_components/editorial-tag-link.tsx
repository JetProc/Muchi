"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { TagDefinition } from "@/lib/archive";
import { MotionLink } from "./editorial-motion";

export function tagGroupHref(tagIds: string[]): string {
  const params = new URLSearchParams();
  [...new Set(tagIds)].forEach((tagId) => params.append("tag", tagId));
  if (tagIds.length) params.set("view", "group");
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

type TagLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  tag: TagDefinition;
  children?: ReactNode;
};

/** A single, reusable route contract for every clickable archive keyword. */
export function TagLink({
  tag,
  children,
  className = "tag",
  ...props
}: TagLinkProps) {
  return (
    <MotionLink
      {...props}
      className={className}
      href={tagGroupHref([tag.id])}
      aria-label={props["aria-label"] ?? `${tag.label} 키워드로 음악 찾기`}
    >
      {children ?? `#${tag.label}`}
    </MotionLink>
  );
}
