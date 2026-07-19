"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { TagDefinition } from "@/lib/archive";
import { MotionLink } from "./editorial-motion";

export function tagSearchHref(
  tagIds: string[],
  options: { fromMemoryId?: string } = {},
): string {
  const params = new URLSearchParams();
  [...new Set(tagIds)].forEach((tagId) => params.append("tag", tagId));
  if (options.fromMemoryId) params.set("fromMemory", options.fromMemoryId);
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

type TagLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  tag: TagDefinition;
  children?: ReactNode;
  fromMemoryId?: string;
};

/** A single, reusable route contract for every clickable archive tag. */
export function TagLink({
  tag,
  children,
  className = "tag",
  fromMemoryId,
  ...props
}: TagLinkProps) {
  return (
    <MotionLink
      {...props}
      className={className}
      href={tagSearchHref([tag.id], { fromMemoryId })}
      aria-label={props["aria-label"] ?? `${tag.label} 태그로 음악 찾기`}
    >
      {children ?? `#${tag.label}`}
    </MotionLink>
  );
}
